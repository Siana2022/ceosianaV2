const SLACK_API = 'https://slack.com/api'

function token() {
  return process.env.SLACK_BOT_TOKEN ?? ''
}

async function resolveChannelId(tok: string, nombre: string): Promise<string> {
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
      body: JSON.stringify({ channel, text }),
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
      body: JSON.stringify({ channel, text }),
    })
  } catch (e) {
    console.error('[slack] DM error:', e)
  }
}
