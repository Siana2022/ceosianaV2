import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'

const SLACK_API = 'https://slack.com/api'

// GET /api/slack/test?canal=activage
// Diagnoses Slack integration step by step
export async function GET(req: NextRequest) {
  const canal = new URL(req.url).searchParams.get('canal') ?? 'activage'
  const tok = process.env.SLACK_BOT_TOKEN ?? ''
  const log: Record<string, unknown> = {}

  log.token_present = !!tok
  log.token_prefix = tok.slice(0, 12)
  log.canal_input = canal

  if (!tok) return NextResponse.json({ error: 'No SLACK_BOT_TOKEN', log })

  // Step 1: Check auth
  const authRes = await fetch(`${SLACK_API}/auth.test`, {
    headers: { Authorization: `Bearer ${tok}` },
  })
  const authData = await authRes.json()
  log.auth = { ok: authData.ok, bot: authData.bot_id, team: authData.team, error: authData.error }

  if (!authData.ok) return NextResponse.json({ error: 'Auth failed', log })

  // Step 2: List channels
  const name = canal.startsWith('#') ? canal.slice(1) : canal
  const listRes = await fetch(`${SLACK_API}/conversations.list?types=public_channel,private_channel&limit=200&exclude_archived=true`, {
    headers: { Authorization: `Bearer ${tok}` },
  })
  const listData = await listRes.json()
  log.conversations_list_ok = listData.ok
  log.conversations_list_error = listData.error
  log.total_channels = listData.channels?.length ?? 0
  const found = listData.channels?.find((c: { name: string; id: string; is_private: boolean }) => c.name === name)
  log.channel_found = found ? { id: found.id, name: found.name, is_private: found.is_private } : null

  if (!found) return NextResponse.json({ error: 'Channel not found in list', log })

  // Step 3: Send test message
  const msgRes = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ channel: found.id, text: '🧪 Test de conexión Ceosiana → Slack ✅' }),
  })
  const msgData = await msgRes.json()
  log.send_message = { ok: msgData.ok, error: msgData.error, ts: msgData.ts }

  // Step 4: Check if slack_canal is saved in DB for any client
  const admin = createAdminClient()
  const { data: clientes } = await admin.from('clientes').select('id, nombre, slack_canal').not('slack_canal', 'is', null)
  log.clientes_con_canal = clientes?.map(c => ({ id: c.id, nombre: c.nombre, canal: c.slack_canal }))

  return NextResponse.json({ ok: msgData.ok, log })
}
