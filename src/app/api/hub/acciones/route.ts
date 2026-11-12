import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'

// GET /api/hub/acciones?id_servicio=<uuid> → últimas acciones del servicio
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const idServicio = new URL(req.url).searchParams.get('id_servicio')
  if (!idServicio) return NextResponse.json({ error: 'id_servicio requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('acciones')
    .select('id, id_servicio, id_cuenta, id_tarea, id_empleado, fecha, tipo, titulo, detalle, minutos, visibilidad, created_at, empleado:id_empleado(nombre)')
    .eq('id_servicio', idServicio)
    .order('fecha', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST → registrar una acción y su fichaje en una sola operación
export async function POST(req: NextRequest) {
  const perfil = await getPerfil()
  if (!perfil?.id_empleado) {
    return NextResponse.json({ error: 'Tu usuario no está vinculado a un empleado' }, { status: 403 })
  }

  const body = await req.json()
  const { id_servicio, titulo, minutos, tipo, detalle, fecha } = body

  if (!id_servicio) return NextResponse.json({ error: 'id_servicio requerido' }, { status: 400 })
  if (!titulo?.trim()) return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })

  const mins = parseInt(minutos)
  if (isNaN(mins) || mins <= 0) return NextResponse.json({ error: 'Los minutos deben ser mayores que 0' }, { status: 400 })

  const supabase = await createClient()

  const { data: servicio } = await supabase
    .from('servicios')
    .select('id, id_cliente')
    .eq('id', id_servicio)
    .maybeSingle()

  if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

  const fechaAccion = fecha || new Date().toISOString().slice(0, 10)

  // 1) Fichaje: así el tiempo entra en costes y dedicación
  const { data: log, error: logError } = await supabase
    .from('time_logs')
    .insert({
      id_empleado: perfil.id_empleado,
      id_servicio: id_servicio,
      id_cliente: servicio.id_cliente,
      descripcion: titulo.trim(),
      fecha: fechaAccion,
      minutos: mins,
    })
    .select('id')
    .single()

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  // 2) Acción: el "qué se hizo" que alimenta el timeline y el conocimiento
  const { data: accion, error: accionError } = await supabase
    .from('acciones')
    .insert({
      id_servicio,
      id_empleado: perfil.id_empleado,
      id_time_log: log.id,
      fecha: fechaAccion,
      tipo: tipo || 'optimizacion',
      titulo: titulo.trim(),
      detalle: detalle?.trim() || null,
      minutos: mins,
      visibilidad: 'interna',
    })
    .select()
    .single()

  if (accionError) {
    return NextResponse.json(
      { error: `El fichaje se guardó, pero la acción no: ${accionError.message}`, id_time_log: log.id },
      { status: 500 },
    )
  }

  return NextResponse.json(accion)
}
