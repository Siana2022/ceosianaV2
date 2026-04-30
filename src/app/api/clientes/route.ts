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
  const { id, nombre, activo, notas } = body

  const { data, error } = await supabase
    .from('clientes')
    .update({ nombre, activo, notas })
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
