import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')

  let query = supabase.from('empleado_dedicacion').select(
    mes && anio ? '*, departamento:id_departamento(id,nombre)' : '*'
  )

  if (mes && anio) {
    query = query.eq('mes', Number(mes)).eq('anio', Number(anio))
  }

  const { data, error } = await query

  if (error) {
    console.error('GET /api/dedicacion', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()

  // Bulk replace: for each unique (id_empleado, mes, anio), delete existing then insert new
  const records = Array.isArray(body) ? body : [body]

  // Find unique (id_empleado, mes, anio) combinations to replace
  const combos = new Map<string, { id_empleado: string; mes: number; anio: number }>()
  for (const r of records) {
    const key = `${r.id_empleado}_${r.mes}_${r.anio}`
    combos.set(key, { id_empleado: r.id_empleado, mes: r.mes, anio: r.anio })
  }

  // Delete existing records for each combo
  for (const { id_empleado, mes, anio } of combos.values()) {
    await supabase
      .from('empleado_dedicacion')
      .delete()
      .eq('id_empleado', id_empleado)
      .eq('mes', mes)
      .eq('anio', anio)
  }

  // Insert new records
  const { data, error } = await supabase
    .from('empleado_dedicacion')
    .insert(records)
    .select()

  if (error) {
    console.error('POST /api/dedicacion', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
