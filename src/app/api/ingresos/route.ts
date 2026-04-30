import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')

  if (!mes || !anio) {
    return NextResponse.json({ error: 'mes and anio are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ingresos')
    .select('*, cliente:id_cliente(id,nombre), departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre), servicio:id_servicio(id,nombre)')
    .eq('mes', Number(mes))
    .eq('anio', Number(anio))

  if (error) {
    console.error('GET /api/ingresos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()

  // Support bulk insert (array) or single insert
  const records = Array.isArray(body) ? body : [body]

  const { data, error } = await supabase
    .from('ingresos')
    .insert(records)
    .select('*, cliente:id_cliente(id,nombre), departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre), servicio:id_servicio(id,nombre)')

  if (error) {
    console.error('POST /api/ingresos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, valor, concepto, id_departamento, id_responsable, notas } = body

  const { data, error } = await supabase
    .from('ingresos')
    .update({ valor, concepto, id_departamento, id_responsable, notas })
    .eq('id', id)
    .select('*, cliente:id_cliente(id,nombre), departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre), servicio:id_servicio(id,nombre)')
    .single()

  if (error) {
    console.error('PUT /api/ingresos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')

  const { error } = await supabase
    .from('ingresos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('DELETE /api/ingresos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
