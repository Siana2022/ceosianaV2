import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { isAdmin, getSessionEmail } from '@/lib/server/isAdmin'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const supabase = await createClient()
  const { data, error } = await supabase.from('alertas_admins').select('id, email').order('email')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { email } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('alertas_admins')
    .insert({ email: email.trim().toLowerCase() })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await request.json()
  // Prevent removing yourself if you're the only admin
  const supabase = await createClient()
  const { count } = await supabase.from('alertas_admins').select('*', { count: 'exact', head: true })
  if ((count ?? 0) <= 1) return NextResponse.json({ error: 'Debe haber al menos un administrador' }, { status: 400 })
  const myEmail = await getSessionEmail()
  const { data: target } = await supabase.from('alertas_admins').select('email').eq('id', id).single()
  if (target?.email === myEmail) return NextResponse.json({ error: 'No puedes eliminarte a ti mismo si eres el único admin' }, { status: 400 })
  const { error } = await supabase.from('alertas_admins').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
