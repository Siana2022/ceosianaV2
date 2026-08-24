const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export function getAuthUrl(userId: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`)
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'refresh_token' }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
  const data = await res.json()
  return data.access_token
}

async function calendarRequest(method: string, path: string, accessToken: string, body?: object) {
  const res = await fetch(`${CALENDAR_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Calendar API ${method} ${path} failed: ${err}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export interface CalendarEventInput {
  summary: string
  description?: string
  date: string       // YYYY-MM-DD
  time?: string | null // HH:MM
}

function buildEvent(input: CalendarEventInput) {
  if (input.time) {
    const start = `${input.date}T${input.time}:00`
    return {
      summary: input.summary,
      description: input.description ?? '',
      start: { dateTime: start, timeZone: 'Europe/Madrid' },
      end: { dateTime: start, timeZone: 'Europe/Madrid' },
    }
  }
  return {
    summary: input.summary,
    description: input.description ?? '',
    start: { date: input.date },
    end: { date: input.date },
  }
}

export async function createCalendarEvent(accessToken: string, calendarId: string, input: CalendarEventInput): Promise<string> {
  const data = await calendarRequest('POST', `/calendars/${encodeURIComponent(calendarId)}/events`, accessToken, buildEvent(input))
  return data.id as string
}

export async function updateCalendarEvent(accessToken: string, calendarId: string, eventId: string, input: CalendarEventInput): Promise<void> {
  await calendarRequest('PUT', `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, accessToken, buildEvent(input))
}

export async function deleteCalendarEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  await calendarRequest('DELETE', `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, accessToken)
}
