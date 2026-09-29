import { createAdminClient } from '@/lib/server/supabase-admin'
import { createClient } from '@/lib/server/supabase'
import { NextRequest, NextResponse } from 'next/server'

// Creates time_logs for ALL responsables of a reunión/visita (manual time entry case)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { id_tarea, minutos, fecha } = body as { id_tarea: string; minutos: number; fecha: string }

  if (!id_tarea || !minutos || minutos <= 0) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: tarea } = await admin
    .from('tareas')
    .select('tipo, ids_responsables, nombre, id_cliente, id_servicio, id_departamento')
    .eq('id', id_tarea)
    .maybeSingle()

  if (!tarea) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
  if (tarea.tipo !== 'reunion' && tarea.tipo !== 'visita') {
    return NextResponse.json({ ok: true })
  }

  const responsables = (tarea.ids_responsables as string[]) ?? []
  if (!responsables.length) return NextResponse.json({ ok: true })

  const fechaLogs = fecha ?? new Date().toISOString().slice(0, 10)
  const inserts = responsables.map(idEmpleado => ({
    id_empleado: idEmpleado,
    id_cliente: tarea.id_cliente ?? null,
    id_servicio: tarea.id_servicio ?? null,
    id_departamento: tarea.id_departamento ?? null,
    descripcion: tarea.nombre as string,
    fecha: fechaLogs,
    minutos: Math.round(minutos),
  }))

  const { error } = await admin.from('time_logs').insert(inserts)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
