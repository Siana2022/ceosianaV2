import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id_cliente = searchParams.get('id_cliente')

  let query = supabase
    .from('servicios')
    .select('*, cliente:id_cliente(id,nombre), departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre)')

  if (id_cliente) {
    query = query.eq('id_cliente', id_cliente)
  }

  const { data, error } = await query

  if (error) {
    console.error('GET /api/servicios', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id_cliente, nombre, tipo, precio_base, id_departamento, id_responsable, fecha_inicio, notas } = body

  const { data, error } = await supabase
    .from('servicios')
    .insert({ id_cliente, nombre, tipo, precio_base, id_departamento, id_responsable, fecha_inicio, notas })
    .select('*, cliente:id_cliente(id,nombre), departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre)')
    .single()

  if (error) {
    console.error('POST /api/servicios', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, nombre, tipo, precio_base, id_departamento, id_responsable, fecha_fin, activo, notas } = body

  const { data, error } = await supabase
    .from('servicios')
    .update({ nombre, tipo, precio_base, id_departamento, id_responsable, fecha_fin, activo, notas })
    .eq('id', id)
    .select('*, cliente:id_cliente(id,nombre), departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre)')
    .single()

  if (error) {
    console.error('PUT /api/servicios', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')

  const { error } = await supabase
    .from('servicios')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('DELETE /api/servicios', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
