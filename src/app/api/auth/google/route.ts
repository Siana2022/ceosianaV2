import { createClient } from '@/lib/server/supabase'
import { getAuthUrl } from '@/lib/google/calendar'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.redirect(getAuthUrl(user.id))
}
