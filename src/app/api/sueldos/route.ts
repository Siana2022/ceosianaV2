import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id_empleado = searchParams.get('id_empleado')
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')

  let query = supabase.from('sueldos').select('*')

  if (id_empleado) {
    query = query.eq('id_empleado', id_empleado)
  } else if (mes && anio) {
    query = query.eq('mes', Number(mes)).eq('anio', Number(anio))
  }

  const { data, error } = await query

  if (error) {
    console.error('GET /api/sueldos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id_empleado, coste_total, mes, anio } = body

  const { data, error } = await supabase
    .from('sueldos')
    .upsert({ id_empleado, coste_total, mes, anio }, { onConflict: 'id_empleado,mes,anio' })
    .select()
    .single()

  if (error) {
    console.error('POST /api/sueldos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, coste_total, mes, anio } = body

  const { data, error } = await supabase
    .from('sueldos')
    .update({ coste_total, mes, anio })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('PUT /api/sueldos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')

  const { error } = await supabase
    .from('sueldos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('DELETE /api/sueldos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
