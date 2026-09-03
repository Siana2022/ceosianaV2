import crypto from 'crypto'
import { NextRequest } from 'next/server'

const SLACK_API = 'https://slack.com/api'

function token() {
  return process.env.SLACK_BOT_TOKEN ?? ''
}

export function verifySlackSignature(req: NextRequest, body: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET ?? ''
  if (!secret) return true
  const ts = req.headers.get('x-slack-request-timestamp') ?? ''
  const sig = req.headers.get('x-slack-signature') ?? ''
  const expected = `v0=${crypto.createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex')}`
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function slackEmailDeUsuario(userId: string): Promise<string | null> {
  const tok = token()
  if (!tok) return null
  const res = await fetch(`${SLACK_API}/users.info?user=${userId}`, {
    headers: { Authorization: `Bearer ${tok}` },
  })
  const data = await res.json()
  return data.ok ? (data.user?.profile?.email ?? null) : null
}

async function resolveChannelId(tok: string, nombre: string): Promise<string> {
  // If it already looks like a Slack ID (C/D/G prefix), use it directly
  if (/^[CDG][A-Z0-9]{6,}$/.test(nombre)) return nombre
  // Strip leading # if present
  const name = nombre.startsWith('#') ? nombre.slice(1) : nombre
  // Try conversations.list to resolve name → ID (needed for private channels)
  try {
    const res = await fetch(`${SLACK_API}/conversations.list?types=public_channel,private_channel&limit=200&exclude_archived=true`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
    const data = await res.json()
    if (data.ok) {
      const found = (data.channels as Array<{ id: string; name: string }>)?.find(c => c.name === name)
      if (found) return found.id
    }
  } catch {
    // fall through to name-based
  }
  return nombre.startsWith('#') ? nombre : `#${nombre}`
}

export async function sendSlackMessage(canal: string, text: string): Promise<void> {
  const tok = token()
  if (!tok || !canal) return
  try {
    const channel = await resolveChannelId(tok, canal)
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ channel, text, unfurl_links: false, unfurl_media: false }),
    })
    const data = await res.json()
    if (!data.ok) console.error('[slack] chat.postMessage error:', data.error, 'channel:', channel)
  } catch (e) {
    console.error('[slack] fetch error:', e)
  }
}

export async function emailsToMenciones(emails: string[]): Promise<string> {
  const tok = token()
  if (!tok || !emails.length) return emails.join(', ')
  const menciones = await Promise.all(emails.map(async email => {
    try {
      const res = await fetch(`${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      const data = await res.json()
      return data.ok ? `<@${data.user.id}>` : email
    } catch {
      return email
    }
  }))
  return menciones.join(', ')
}

export async function sendSlackDM(email: string, text: string): Promise<void> {
  const tok = token()
  if (!tok || !email) return
  try {
    // Lookup user by email
    const lookupRes = await fetch(`${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
    const lookupData = await lookupRes.json()
    if (!lookupData.ok) return
    const userId = lookupData.user?.id
    if (!userId) return

    // Open DM channel and send
    const dmRes = await fetch(`${SLACK_API}/conversations.open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ users: userId }),
    })
    const dmData = await dmRes.json()
    if (!dmData.ok) return
    const channel = dmData.channel?.id
    if (!channel) return

    await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ channel, text, unfurl_links: false, unfurl_media: false }),
    })
  } catch (e) {
    console.error('[slack] DM error:', e)
  }
}
