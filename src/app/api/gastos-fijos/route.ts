import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')

  let query = supabase.from('gastos_fijos').select('*')

  if (mes && anio) {
    query = query.eq('mes', Number(mes)).eq('anio', Number(anio))
  }

  const { data, error } = await query

  if (error) {
    console.error('GET /api/gastos-fijos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { concepto, valor, tipo, id_departamento, mes, anio } = body

  const { data, error } = await supabase
    .from('gastos_fijos')
    .insert({ concepto, valor, tipo, id_departamento, mes, anio })
    .select()
    .single()

  if (error) {
    console.error('POST /api/gastos-fijos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, concepto, valor, tipo, id_departamento } = body

  const { data, error } = await supabase
    .from('gastos_fijos')
    .update({ concepto, valor, tipo, id_departamento })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('PUT /api/gastos-fijos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')

  const { error } = await supabase
    .from('gastos_fijos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('DELETE /api/gastos-fijos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
