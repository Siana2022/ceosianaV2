const SLACK_API = 'https://slack.com/api'

function token() {
  return process.env.SLACK_BOT_TOKEN ?? ''
}

export async function sendSlackMessage(canal: string, text: string): Promise<void> {
  const tok = token()
  if (!tok || !canal) return
  const channel = canal.startsWith('#') ? canal : `#${canal}`
  try {
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ channel, text }),
    })
    const data = await res.json()
    if (!data.ok) console.error('[slack] chat.postMessage error:', data.error)
  } catch (e) {
    console.error('[slack] fetch error:', e)
  }
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
