import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')

  let query = supabase.from('empleado_dedicacion').select('*')

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

  // Bulk upsert array of { id_empleado, id_departamento, porcentaje, mes, anio }
  const records = Array.isArray(body) ? body : [body]

  const { data, error } = await supabase
    .from('empleado_dedicacion')
    .upsert(records, { onConflict: 'id_empleado,id_departamento,mes,anio' })
    .select()

  if (error) {
    console.error('POST /api/dedicacion', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
