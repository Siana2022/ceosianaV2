import { createClient } from '@/lib/server/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { syncTareaToAllResponsables } from '@/lib/google/syncTarea'

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
  try {
    const supabase = await createClient()
    const body = await req.json() as Record<string, unknown>
    const row = bodyToDbRow(body)
    if (body.id) row.id = body.id  // accept client-generated UUID
    const { data, error } = await supabase.from('tareas').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const tarea = rowToTarea(data as Record<string, unknown>)
    // Sync to Google Calendar for all responsables (fire-and-forget)
    if (tarea.fechaLimite && (tarea.idsResponsables as string[]).length > 0) {
      syncTareaToAllResponsables(tarea.id as string, tarea.idsResponsables as string[], {
        summary: tarea.nombre as string,
        description: tarea.descripcion as string,
        date: tarea.fechaLimite as string,
        time: tarea.hora as string | null,
      })
    }
    return NextResponse.json(tarea)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    const body = await req.json() as Record<string, unknown>
    const row = bodyToDbRow(body)
    if (Object.keys(row).length === 0) return NextResponse.json({ ok: true })
    const { error } = await supabase.from('tareas').update(row).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Sync calendar if date or name changed
    if (body.fechaLimite || body.nombre || body.hora) {
      const { data: tarea } = await supabase.from('tareas').select('nombre, fecha_limite, hora, ids_responsables, descripcion').eq('id', id).maybeSingle()
      if (tarea && tarea.fecha_limite && (tarea.ids_responsables as string[])?.length > 0) {
        syncTareaToAllResponsables(id, tarea.ids_responsables as string[], {
          summary: tarea.nombre as string,
          description: (tarea.descripcion as string) ?? '',
          date: tarea.fecha_limite as string,
          time: tarea.hora as string | null,
        })
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
