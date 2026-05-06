import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nombre')

  if (error) {
    console.error('GET /api/clientes', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { nombre, fecha_alta, notas } = body

  const { data, error } = await supabase
    .from('clientes')
    .insert({ nombre, fecha_alta, notas })
    .select()
    .single()

  if (error) {
    console.error('POST /api/clientes', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, nombre, activo, notas, fecha_alta } = body

  const { data, error } = await supabase
    .from('clientes')
    .update({ nombre, activo, notas, fecha_alta: fecha_alta ?? undefined })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('PUT /api/clientes', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  // Cascade: delete related data first
  // 1. Get service IDs for this client
  const { data: servicios } = await supabase
    .from('servicios')
    .select('id')
    .eq('id_cliente', id)

  const servicioIds = (servicios ?? []).map(s => s.id)

  // 2. Delete in parallel: ingresos, gastos_fijos, captacion_clientes, servicio_responsables for this client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cascadePromises: any[] = [
    supabase.from('ingresos').delete().eq('id_cliente', id),
    supabase.from('gastos_fijos').delete().eq('id_cliente', id),
    supabase.from('captacion_clientes').delete().eq('id_cliente', id),
  ]

  if (servicioIds.length > 0) {
    cascadePromises.push(
      supabase.from('servicio_responsables').delete().in('id_servicio', servicioIds)
    )
  }

  await Promise.all(cascadePromises)

  // 3. Delete services
  if (servicioIds.length > 0) {
    await supabase.from('servicios').delete().eq('id_cliente', id)
  }

  // 4. Delete the client itself
  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('DELETE /api/clientes', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
