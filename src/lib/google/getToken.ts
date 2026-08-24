import { createAdminClient } from '@/lib/server/supabase-admin'
import { refreshAccessToken } from './calendar'

export async function getValidAccessToken(userId: string): Promise<{ accessToken: string; calendarId: string } | null> {
  const admin = createAdminClient()
  const { data: perfil } = await admin
    .from('perfiles')
    .select('google_access_token, google_refresh_token, google_calendar_id')
    .eq('id', userId)
    .maybeSingle()

  if (!perfil?.google_refresh_token) return null

  try {
    const accessToken = await refreshAccessToken(perfil.google_refresh_token)
    // Update stored access token
    await admin.from('perfiles').update({ google_access_token: accessToken }).eq('id', userId)
    return { accessToken, calendarId: perfil.google_calendar_id ?? 'primary' }
  } catch {
    return null
  }
}
