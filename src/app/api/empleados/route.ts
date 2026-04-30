import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('empleados')
    .select('*')
    .order('nombre')

  if (error) {
    console.error('GET /api/empleados', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { nombre, email, fecha_alta } = body

  const { data, error } = await supabase
    .from('empleados')
    .insert({ nombre, email, fecha_alta })
    .select()
    .single()

  if (error) {
    console.error('POST /api/empleados', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, nombre, email, activo, fecha_alta, fecha_baja } = body

  const { data, error } = await supabase
    .from('empleados')
    .update({ nombre, email, activo, fecha_alta, fecha_baja })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('PUT /api/empleados', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')

  const { error } = await supabase
    .from('empleados')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('DELETE /api/empleados', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
