import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const anio = searchParams.get('anio')

  if (!anio) {
    return NextResponse.json({ error: 'anio is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('empleado_dedicacion')
    .select('*')
    .eq('anio', Number(anio))
    .eq('mes', 1)

  if (error) {
    console.error('GET /api/dedicacion/anio', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
