import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

// GET: fetch control_facturacion records for a given mes+anio
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')

  if (!mes || !anio) {
    return NextResponse.json({ error: 'mes y anio son obligatorios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('control_facturacion')
    .select('*')
    .eq('mes', parseInt(mes))
    .eq('anio', parseInt(anio))

  if (error) {
    console.error('GET /api/administracion', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST: upsert billing state for a client in a given month
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id_cliente, mes, anio, estado, notas } = body

  if (!id_cliente || !mes || !anio || !estado) {
    return NextResponse.json(
      { error: 'id_cliente, mes, anio y estado son obligatorios' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('control_facturacion')
    .upsert(
      { id_cliente, mes, anio, estado, notas: notas ?? null },
      { onConflict: 'id_cliente,mes,anio' }
    )
    .select()
    .single()

  if (error) {
    console.error('POST /api/administracion', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
