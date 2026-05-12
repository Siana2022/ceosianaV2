import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { isAdmin } from '@/lib/server/isAdmin'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const supabase = await createClient()
  const { data, error } = await supabase.from('alertas_config').select('*').order('tipo')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { tipo, activa } = await request.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('alertas_config')
    .update({ activa })
    .eq('tipo', tipo)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
