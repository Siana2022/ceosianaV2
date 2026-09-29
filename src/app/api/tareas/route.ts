import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { syncTareaToAllResponsables } from '@/lib/google/syncTarea'
import { sendSlackMessage, emailsToMenciones } from '@/lib/slack'

async function notificarNuevosResponsables(
  idTarea: string, nombreTarea: string, nuevos: string[], antiguos: string[]
) {
  const admin = createAdminClient()
  const realmNuevos = nuevos.filter(id => !antiguos.includes(id))
  if (!realmNuevos.length) return
  const inserts = realmNuevos.map(idEmpleado => ({
    id_empleado: idEmpleado,
    tipo: 'tarea_asignada',
    titulo: `Nueva tarea asignada: "${nombreTarea}"`,
    mensaje: null as string | null,
    id_tarea: idTarea,
    leida: false,
  }))
  await admin.from('notificaciones_empleado').insert(inserts)
}

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
  checklist: 'checklist',
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
    checklist: row.checklist ?? [],
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

function slackMsgNuevaTarea(opts: {
  nombre: string; descripcion: string | null; menciones: string; fecha: string
  tareaId: string; base: string; cliente: string | null; departamento: string | null
}): string {
  const { nombre, descripcion, menciones, fecha, tareaId, base, cliente, departamento } = opts
  const partes = [nombre, cliente ? cliente.toUpperCase() : null, departamento].filter(Boolean)
  const titulo = partes.join(' — ')
  const desc = descripcion?.trim() ? `\n_${descripcion.trim()}_` : ''
  const link = `<${base}/tareas/vista-global?tarea=${tareaId}|Ver tarea →>`
  return `*${titulo}*${desc}\n👤 ${menciones}\n📅 ${fecha}\n🔗 ${link}\n---`
}

interface ClienteInfo { canal: string | null; nombre: string | null }

async function infoCliente(idCliente: string | null | undefined): Promise<ClienteInfo> {
  if (!idCliente) return { canal: null, nombre: null }
  const admin = createAdminClient()
  const { data } = await admin.from('clientes').select('slack_canal, nombre').eq('id', idCliente).maybeSingle()
  const row = data as Record<string, string | null> | null
  return { canal: row?.slack_canal ?? null, nombre: row?.nombre ?? null }
}

async function nombreDepartamento(idDep: string | null | undefined): Promise<string | null> {
  if (!idDep) return null
  const admin = createAdminClient()
  const { data } = await admin.from('departamentos').select('nombre').eq('id', idDep).maybeSingle()
  return (data as Record<string, string | null> | null)?.nombre ?? null
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
    // Calendar + Slack son side-effects: nunca deben romper la respuesta al cliente
    ;(async () => {
      try {
        if (tarea.syncCalendar && tarea.fechaLimite && (tarea.idsResponsables as string[]).length > 0) {
          await syncTareaToAllResponsables(tarea.id as string, tarea.idsResponsables as string[], {
            summary: tarea.nombre as string,
            description: tarea.descripcion as string,
            date: tarea.fechaLimite as string,
            time: tarea.hora as string | null,
          })
        }
      } catch (e) { console.error('[tareas POST] calendar sync error:', e) }
      try {
        const responsableIds = tarea.idsResponsables as string[]
        if (responsableIds.length > 0 && tarea.idCliente) {
          const [clienteInfo, depNombre] = await Promise.all([
            infoCliente(tarea.idCliente as string),
            nombreDepartamento(tarea.idDepartamento as string | null),
          ])
          if (clienteInfo.canal) {
            const menciones = await mencionesResponsables(responsableIds)
            const fecha = tarea.fechaLimite ? new Date(tarea.fechaLimite as string).toLocaleDateString('es-ES') : '—'
            await sendSlackMessage(clienteInfo.canal, slackMsgNuevaTarea({
              nombre: tarea.nombre as string, descripcion: tarea.descripcion as string,
              menciones, fecha, tareaId: tarea.id as string, base,
              cliente: clienteInfo.nombre, departamento: depNombre,
            }))
          }
        }
      } catch (e) { console.error('[tareas POST] slack error:', e) }
    })()
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
    // Atomic increment: client sends delta only, server fetches current value and adds
    if ('minutosIncremento' in body && typeof body.minutosIncremento === 'number') {
      const { data: cur } = await supabase.from('tareas').select('minutos_acumulados').eq('id', id).maybeSingle()
      body.minutosAcumulados = (Number((cur as Record<string, unknown> | null)?.minutos_acumulados) || 0) + body.minutosIncremento
      delete body.minutosIncremento
    }
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
    // Calendar + Slack son side-effects: se ejecutan en background, nunca bloquean la respuesta
    const needsTareaFetch = body.fechaLimite || body.nombre || body.hora || body.syncCalendar !== undefined || body.estado === 'bloqueada' || body.estado === 'terminado' || (newResponsables && newResponsables.length > 0)
    if (needsTareaFetch) {
      ;(async () => {
        try {
          const { data: tarea } = await supabase.from('tareas').select('nombre, fecha_limite, hora, ids_responsables, descripcion, sync_calendar, id_cliente, id_departamento').eq('id', id).maybeSingle()
          if (!tarea) return
          const respIds = (tarea.ids_responsables as string[]) ?? []
          try {
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
          } catch (e) { console.error('[tareas PATCH] calendar sync error:', e) }
          if (newResponsables && newResponsables.length > 0) {
            notificarNuevosResponsables(id, tarea.nombre as string, newResponsables, oldResponsables).catch(() => {})
          }
          try {
            const [clienteInfo, depNombre] = await Promise.all([
              infoCliente(tarea.id_cliente as string | null),
              nombreDepartamento(tarea.id_departamento as string | null),
            ])
            if (clienteInfo.canal) {
              if (newResponsables && newResponsables.length > 0 && oldResponsables.length === 0) {
                const menciones = await mencionesResponsables(respIds)
                const fecha = tarea.fecha_limite ? new Date(tarea.fecha_limite as string).toLocaleDateString('es-ES') : '—'
                await sendSlackMessage(clienteInfo.canal, slackMsgNuevaTarea({
                  nombre: tarea.nombre as string, descripcion: tarea.descripcion as string,
                  menciones, fecha, tareaId: id, base,
                  cliente: clienteInfo.nombre, departamento: depNombre,
                }))
              }
              if (body.estado === 'bloqueada' || body.estado === 'terminado') {
                const link = `<${base}/tareas/vista-global?tarea=${id}|Ver tarea →>`
                const msg = body.estado === 'terminado'
                  ? `✅ *Tarea completada*\n*${tarea.nombre}*\n🔗 ${link}\n---`
                  : `🔴 *Tarea bloqueada*\n*${tarea.nombre}*${body.explicacionBloqueo ? `\n> ${body.explicacionBloqueo}` : ''}\n🔗 ${link}\n---`
                await sendSlackMessage(clienteInfo.canal, msg)
              }
            }
          } catch (e) { console.error('[tareas PATCH] slack error:', e) }
        } catch (e) { console.error('[tareas PATCH] side-effects error:', e) }
      })()
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
