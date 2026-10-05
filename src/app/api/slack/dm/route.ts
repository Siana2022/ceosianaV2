import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { sendSlackDM } from '@/lib/slack'

// POST /api/slack/dm — send a Slack DM to an employee
// Body: { idEmpleado: string, text: string }
export async function POST(req: NextRequest) {
  try {
    const { idEmpleado, text } = await req.json() as { idEmpleado: string; text: string }
    if (!idEmpleado || !text) return NextResponse.json({ ok: true })
    const admin = createAdminClient()
    const { data } = await admin.from('empleados').select('email, slack_email').eq('id', idEmpleado).maybeSingle()
    const email = (data as { email: string | null; slack_email: string | null } | null)?.slack_email
      || (data as { email: string | null; slack_email: string | null } | null)?.email
    if (email) await sendSlackDM(email, text)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
