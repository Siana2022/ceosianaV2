import { createAdminClient } from '@/lib/server/supabase-admin'
import { exchangeCode } from '@/lib/google/calendar'
import { NextRequest, NextResponse } from 'next/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !userId) {
    return NextResponse.redirect(`${APP_URL}/perfil?error=google_denied`)
  }

  try {
    const { access_token, refresh_token } = await exchangeCode(code)
    const admin = createAdminClient()
    await admin.from('perfiles').update({
      google_access_token: access_token,
      google_refresh_token: refresh_token,
      google_calendar_id: 'primary',
    }).eq('id', userId)

    return NextResponse.redirect(`${APP_URL}/perfil?connected=1`)
  } catch (e) {
    console.error('[google/callback]', e)
    return NextResponse.redirect(`${APP_URL}/perfil?error=token_failed`)
  }
}
