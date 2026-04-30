import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('captacion_clientes')
    .select('*, captador:id_captador(id,nombre), mantenedor:id_mantenedor(id,nombre), cliente:id_cliente(id,nombre)')

  if (error) {
    console.error('GET /api/captacion', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id_cliente, id_captador, id_mantenedor, fecha_inicio } = body

  const { data, error } = await supabase
    .from('captacion_clientes')
    .insert({ id_cliente, id_captador, id_mantenedor, fecha_inicio })
    .select('*, captador:id_captador(id,nombre), mantenedor:id_mantenedor(id,nombre), cliente:id_cliente(id,nombre)')
    .single()

  if (error) {
    console.error('POST /api/captacion', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, id_captador, id_mantenedor, fecha_fin } = body

  const { data, error } = await supabase
    .from('captacion_clientes')
    .update({ id_captador, id_mantenedor, fecha_fin })
    .eq('id', id)
    .select('*, captador:id_captador(id,nombre), mantenedor:id_mantenedor(id,nombre), cliente:id_cliente(id,nombre)')
    .single()

  if (error) {
    console.error('PUT /api/captacion', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')

  const { error } = await supabase
    .from('captacion_clientes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('DELETE /api/captacion', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
