import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')

  let query = supabase
    .from('gastos_fijos')
    .select('*, departamento:id_departamento(id,nombre)')
    .order('concepto')

  if (mes) query = query.eq('mes', parseInt(mes))
  if (anio) query = query.eq('anio', parseInt(anio))

  const { data, error } = await query
  if (error) {
    console.error('GET /api/costes', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { concepto, valor, tipo, id_departamento, mes, anio } = body

  if (!concepto || valor === undefined || !mes || !anio) {
    return NextResponse.json({ error: 'concepto, valor, mes y anio son obligatorios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('gastos_fijos')
    .insert({ concepto, valor, tipo, id_departamento: tipo === 'departamento' ? id_departamento : null, mes, anio })
    .select('*, departamento:id_departamento(id,nombre)')
    .single()

  if (error) {
    console.error('POST /api/costes', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, concepto, valor, tipo, id_departamento, mes, anio } = body

  const { data, error } = await supabase
    .from('gastos_fijos')
    .update({ concepto, valor, tipo, id_departamento: tipo === 'departamento' ? id_departamento : null, mes, anio })
    .eq('id', id)
    .select('*, departamento:id_departamento(id,nombre)')
    .single()

  if (error) {
    console.error('PUT /api/costes', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')

  const { error } = await supabase.from('gastos_fijos').delete().eq('id', id)
  if (error) {
    console.error('DELETE /api/costes', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
