import { createAdminClient } from '@/lib/server/supabase-admin'
import { createClient } from '@/lib/server/supabase'
import { NextRequest, NextResponse } from 'next/server'

// Creates time_logs for ALL responsables of a reunión/visita (manual time entry case)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { id_tarea, minutos, fecha, id_empleado_actual, id_cliente, id_servicio, id_departamento } = body as {
    id_tarea: string; minutos: number; fecha: string; id_empleado_actual?: string | null
    id_cliente?: string | null; id_servicio?: string | null; id_departamento?: string | null
  }

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

  const esReunion = tarea.tipo === 'reunion' || tarea.tipo === 'visita'

  // For regular tasks: only log for the person saving (id_empleado_actual)
  // For reunions/visitas: log for all responsables
  let responsables: string[]
  if (esReunion) {
    responsables = (tarea.ids_responsables as string[]) ?? []
  } else {
    if (!id_empleado_actual) return NextResponse.json({ ok: true })
    responsables = [id_empleado_actual]
  }

  if (!responsables.length) return NextResponse.json({ ok: true })

  const fechaLogs = fecha ?? new Date().toISOString().slice(0, 10)

  // Para reuniones/visitas: evitar duplicados (la reunión solo se registra una vez por persona)
  // Para tareas normales: siempre insertar (el delta de minutos puede crecer en varias sesiones)
  let pendientes = responsables
  if (esReunion) {
    const { data: existing } = await admin
      .from('time_logs')
      .select('id_empleado')
      .eq('id_tarea', id_tarea)
    const yaFichados = new Set((existing ?? []).map((r: { id_empleado: string }) => r.id_empleado))
    pendientes = responsables.filter(id => !yaFichados.has(id))
    if (!pendientes.length) return NextResponse.json({ ok: true, skipped: true })
  }

  const inserts = pendientes.map(idEmpleado => ({
    id_empleado: idEmpleado,
    id_tarea,
    id_cliente: id_cliente ?? tarea.id_cliente ?? null,
    id_servicio: id_servicio ?? tarea.id_servicio ?? null,
    id_departamento: id_departamento ?? tarea.id_departamento ?? null,
    descripcion: tarea.nombre as string,
    fecha: fechaLogs,
    minutos: Math.round(minutos),
  }))

  const { error } = await admin.from('time_logs').insert(inserts)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
