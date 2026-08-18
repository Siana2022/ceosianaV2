import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { getDedicacionCalculada } from '@/lib/server/dedicacionCalculada'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const mesParam = searchParams.get('mes')
  const anioParam = searchParams.get('anio')

  const data = await getDedicacionCalculada(supabase, {
    anio: anioParam ? Number(anioParam) : undefined,
    mes: mesParam ? Number(mesParam) : undefined,
  })

  return NextResponse.json(data)
}
