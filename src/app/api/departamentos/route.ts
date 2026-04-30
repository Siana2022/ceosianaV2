import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('departamentos')
    .select('*')
    .order('nombre')

  if (error) {
    console.error('GET /api/departamentos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { nombre } = body

  const { data, error } = await supabase
    .from('departamentos')
    .insert({ nombre })
    .select()
    .single()

  if (error) {
    console.error('POST /api/departamentos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, nombre, activo } = body

  const { data, error } = await supabase
    .from('departamentos')
    .update({ nombre, activo })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('PUT /api/departamentos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')

  const { error } = await supabase
    .from('departamentos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('DELETE /api/departamentos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
