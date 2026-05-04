import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

// GET ?id_cliente=X&anio=Y  → all responsables for all services of a client in a year
// GET ?id_servicio=X&anio=Y → all responsables for one service in a year
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id_cliente = searchParams.get('id_cliente')
  const id_servicio = searchParams.get('id_servicio')
  const anio = searchParams.get('anio')

  if (!anio) return NextResponse.json({ error: 'anio es obligatorio' }, { status: 400 })

  let query = supabase
    .from('servicio_responsables')
    .select('id, id_servicio, id_empleado, mes, anio, porcentaje, empleado:id_empleado(id,nombre)')
    .eq('anio', parseInt(anio))

  if (id_servicio) {
    query = query.eq('id_servicio', id_servicio)
  } else if (id_cliente) {
    // Filter by services belonging to this client
    const { data: servicios } = await supabase
      .from('servicios')
      .select('id')
      .eq('id_cliente', id_cliente)
    const ids = (servicios ?? []).map(s => s.id)
    if (ids.length === 0) return NextResponse.json([])
    query = query.in('id_servicio', ids)
  }

  const { data, error } = await query
  if (error) {
    console.error('GET /api/servicio-responsables', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST { id_servicio, mes, anio, asignaciones: [{id_empleado, porcentaje}] }
// Replaces ALL responsables for that service+mes+anio
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id_servicio, mes, anio, asignaciones } = body

  if (!id_servicio || !mes || !anio) {
    return NextResponse.json({ error: 'id_servicio, mes y anio son obligatorios' }, { status: 400 })
  }

  // Delete existing for this service+month
  await supabase
    .from('servicio_responsables')
    .delete()
    .eq('id_servicio', id_servicio)
    .eq('mes', mes)
    .eq('anio', anio)

  if (!asignaciones || asignaciones.length === 0) {
    return NextResponse.json([])
  }

  const rows = asignaciones.map((a: { id_empleado: string; porcentaje: number }) => ({
    id_servicio,
    id_empleado: a.id_empleado,
    mes,
    anio,
    porcentaje: a.porcentaje,
  }))

  const { data, error } = await supabase
    .from('servicio_responsables')
    .insert(rows)
    .select('id, id_servicio, id_empleado, mes, anio, porcentaje, empleado:id_empleado(id,nombre)')

  if (error) {
    console.error('POST /api/servicio-responsables', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
