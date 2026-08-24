import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('perfiles')
    .select('id, rol, slack_username, google_calendar_id, google_refresh_token')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    ...data,
    email: user.email,
    googleConnected: !!data?.google_refresh_token,
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const admin = createAdminClient()

  const allowed = ['slack_username', 'google_calendar_id']
  if (body.disconnect_google) {
    await admin.from('perfiles').update({ google_access_token: null, google_refresh_token: null, google_calendar_id: null }).eq('id', user.id)
    return NextResponse.json({ ok: true })
  }

  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }
  if (Object.keys(update).length > 0) {
    await admin.from('perfiles').update(update).eq('id', user.id)
  }
  return NextResponse.json({ ok: true })
}
