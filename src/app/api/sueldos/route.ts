import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id_empleado = searchParams.get('id_empleado')
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')

  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  // Range mode: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD → aggregate per employee
  if (desde && hasta) {
    const [desdeAnio, desdeMes] = desde.split('-').map(Number)
    const [hastaAnio, hastaMes] = hasta.split('-').map(Number)
    const { data, error } = await supabase
      .from('sueldos')
      .select('id_empleado, coste_total, mes, anio')
      .gte('anio', desdeAnio)
      .lte('anio', hastaAnio)
    if (error) {
      console.error('GET /api/sueldos range', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const filtered = (data ?? []).filter(r => {
      const n = r.anio * 12 + r.mes
      return n >= desdeAnio * 12 + desdeMes && n <= hastaAnio * 12 + hastaMes
    })
    const map = new Map<string, number>()
    for (const r of filtered) {
      map.set(r.id_empleado, (map.get(r.id_empleado) ?? 0) + Number(r.coste_total))
    }
    return NextResponse.json(Array.from(map.entries()).map(([id_empleado, total]) => ({ id_empleado, total })))
  }

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
