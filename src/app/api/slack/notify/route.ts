import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { sendSlackMessage } from '@/lib/slack'

// POST /api/slack/notify — send a message to a client's Slack channel
// Body: { idCliente: string, text: string }
export async function POST(req: NextRequest) {
  try {
    const { idCliente, text } = await req.json() as { idCliente: string; text: string }
    if (!idCliente || !text) return NextResponse.json({ ok: true })
    const admin = createAdminClient()
    const { data } = await admin.from('clientes').select('slack_canal').eq('id', idCliente).maybeSingle()
    const canal = (data as Record<string, string | null> | null)?.slack_canal
    if (canal) await sendSlackMessage(canal, text)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
