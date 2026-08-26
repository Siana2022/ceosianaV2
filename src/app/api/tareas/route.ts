import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { syncTareaToAllResponsables } from '@/lib/google/syncTarea'
import { sendSlackMessage, emailsToMenciones } from '@/lib/slack'

// camelCase (JS) → snake_case (DB)
const CAMINO: Record<string, string> = {
  nombre: 'nombre',
  tipo: 'tipo',
  idCliente: 'id_cliente',
  idServicio: 'id_servicio',
  idDepartamento: 'id_departamento',
  idsResponsables: 'ids_responsables',
  fechaLimite: 'fecha_limite',
  hora: 'hora',
  lugar: 'lugar',
  estado: 'estado',
  explicacionBloqueo: 'explicacion_bloqueo',
  enlaceInfo: 'enlace_info',
  descripcion: 'descripcion',
  recurrencia: 'recurrencia',
  minutosAcumulados: 'minutos_acumulados',
  syncCalendar: 'sync_calendar',
  chat: 'chat',
  adjuntos: 'adjuntos',
  imagenes: 'imagenes',
}

// snake_case row → camelCase Tarea
function rowToTarea(row: Record<string, unknown>) {
  return {
    id: row.id,
    nombre: row.nombre ?? '',
    tipo: row.tipo ?? 'tarea',
    idCliente: row.id_cliente ?? null,
    idServicio: row.id_servicio ?? null,
    idDepartamento: row.id_departamento ?? null,
    idsResponsables: row.ids_responsables ?? [],
    fechaLimite: row.fecha_limite ?? new Date().toISOString().slice(0, 10),
    hora: row.hora ?? null,
    lugar: row.lugar ?? null,
    estado: row.estado ?? 'espera',
    explicacionBloqueo: row.explicacion_bloqueo ?? null,
    enlaceInfo: row.enlace_info ?? '',
    descripcion: row.descripcion ?? '',
    recurrencia: row.recurrencia ?? 'ninguna',
    minutosAcumulados: row.minutos_acumulados ?? 0,
    syncCalendar: row.sync_calendar ?? false,
    timerActivo: false,
    chat: row.chat ?? [],
    adjuntos: row.adjuntos ?? [],
    imagenes: (row.imagenes as unknown[]) ?? [],
  }
}

function bodyToDbRow(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const [jsKey, dbKey] of Object.entries(CAMINO)) {
    if (jsKey in body) row[dbKey] = body[jsKey]
  }
  return row
}

function appUrl(req: NextRequest): string {
  const u = new URL(req.url)
  return `${u.protocol}//${u.host}`
}

function slackMsgNuevaTarea(nombre: string, descripcion: string | null, menciones: string, fecha: string, tareaId: string, base: string): string {
  const desc = descripcion?.trim() ? `\n_${descripcion.trim()}_` : ''
  const link = `<${base}/tareas/vista-global?tarea=${tareaId}|Ver tarea →>`
  return `📋 *Nueva tarea asignada*\n*${nombre}*${desc}\n👤 ${menciones}\n📅 Fecha límite: ${fecha}\n🔗 ${link}`
}

async function slackCanalDeCliente(idCliente: string | null | undefined): Promise<string | null> {
  if (!idCliente) return null
  const admin = createAdminClient()
  const { data } = await admin.from('clientes').select('slack_canal').eq('id', idCliente).maybeSingle()
  return (data as Record<string, string | null> | null)?.slack_canal ?? null
}

async function mencionesResponsables(ids: string[]): Promise<string> {
  if (!ids.length) return ''
  const admin = createAdminClient()
  const { data } = await admin.from('empleados').select('email').in('id', ids)
  const emails = (data ?? []).map((e: { email: string }) => e.email).filter(Boolean)
  return emailsToMenciones(emails)
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json((data ?? []).map(rowToTarea))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const base = appUrl(req)
  try {
    const supabase = await createClient()
    const body = await req.json() as Record<string, unknown>
    const row = bodyToDbRow(body)
    if (body.id) row.id = body.id  // accept client-generated UUID
    const { data, error } = await supabase.from('tareas').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const tarea = rowToTarea(data as Record<string, unknown>)
    if (tarea.syncCalendar && tarea.fechaLimite && (tarea.idsResponsables as string[]).length > 0) {
      await syncTareaToAllResponsables(tarea.id as string, tarea.idsResponsables as string[], {
        summary: tarea.nombre as string,
        description: tarea.descripcion as string,
        date: tarea.fechaLimite as string,
        time: tarea.hora as string | null,
      })
    }
    // Slack: nueva tarea asignada
    const responsableIds = tarea.idsResponsables as string[]
    if (responsableIds.length > 0 && tarea.idCliente) {
      const canal = await slackCanalDeCliente(tarea.idCliente as string)
      if (canal) {
        const responsablesStr = await mencionesResponsables(responsableIds)
        const fecha = tarea.fechaLimite ? new Date(tarea.fechaLimite as string).toLocaleDateString('es-ES') : '—'
        await sendSlackMessage(canal, slackMsgNuevaTarea(tarea.nombre as string, tarea.descripcion as string, responsablesStr, fecha, tarea.id as string, base))
      }
    }
    return NextResponse.json(tarea)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const base = appUrl(req)
  try {
    const supabase = await createClient()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    const body = await req.json() as Record<string, unknown>
    const row = bodyToDbRow(body)
    if (Object.keys(row).length === 0) return NextResponse.json({ ok: true })
    // Fetch BEFORE update to detect responsable changes (for Slack "nueva tarea asignada")
    const newResponsables = body.idsResponsables as string[] | undefined
    let oldResponsables: string[] = []
    if (newResponsables && newResponsables.length > 0) {
      const { data: prev } = await supabase.from('tareas').select('ids_responsables').eq('id', id).maybeSingle()
      oldResponsables = (prev?.ids_responsables as string[]) ?? []
    }
    const { error } = await supabase.from('tareas').update(row).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Fetch tarea for calendar sync and Slack notifications when needed
    const needsTareaFetch = body.fechaLimite || body.nombre || body.hora || body.syncCalendar !== undefined || body.estado === 'bloqueada' || body.estado === 'terminado' || (newResponsables && newResponsables.length > 0)
    if (needsTareaFetch) {
      const { data: tarea } = await supabase.from('tareas').select('nombre, fecha_limite, hora, ids_responsables, descripcion, sync_calendar, id_cliente').eq('id', id).maybeSingle()
      if (tarea) {
        // Calendar sync
        const respIds = (tarea.ids_responsables as string[]) ?? []
        if (respIds.length > 0 && (body.fechaLimite || body.nombre || body.hora || body.syncCalendar !== undefined)) {
          if (tarea.sync_calendar && tarea.fecha_limite) {
            await syncTareaToAllResponsables(id, respIds, {
              summary: tarea.nombre as string,
              description: (tarea.descripcion as string) ?? '',
              date: tarea.fecha_limite as string,
              time: tarea.hora as string | null,
            })
          } else if (body.syncCalendar === false) {
            await syncTareaToAllResponsables(id, respIds, null)
          }
        }
        // Slack notifications
        const canal = await slackCanalDeCliente(tarea.id_cliente as string | null)
        if (canal) {
          // Nueva tarea asignada: responsables added where there were none before
          const respIds = (tarea.ids_responsables as string[]) ?? []
          if (newResponsables && newResponsables.length > 0 && oldResponsables.length === 0) {
            const responsablesStr = await mencionesResponsables(respIds)
            const fecha = tarea.fecha_limite ? new Date(tarea.fecha_limite as string).toLocaleDateString('es-ES') : '—'
            await sendSlackMessage(canal, slackMsgNuevaTarea(tarea.nombre as string, tarea.descripcion as string, responsablesStr, fecha, id, base))
          }
          // Estado changes
          if (body.estado === 'bloqueada' || body.estado === 'terminado') {
            const msg = body.estado === 'terminado'
              ? `✅ *Tarea completada*\n*${tarea.nombre}*`
              : `🔴 *Tarea bloqueada*\n*${tarea.nombre}*${body.explicacionBloqueo ? `\n> ${body.explicacionBloqueo}` : ''}`
            await sendSlackMessage(canal, msg)
          }
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    const { error } = await supabase.from('tareas').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
