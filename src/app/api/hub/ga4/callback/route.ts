import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { canjearCodigo } from '@/lib/server/ga4'

// GET /api/hub/ga4/callback — vuelve de Google con el código
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get('ga4_state')?.value

  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL('/hub?ga4=error', url.origin))
  }

  const redirectUri = `${url.origin}/api/hub/ga4/callback`

  try {
    const t = await canjearCodigo(code, redirectUri)

    // Email de la cuenta conectada
    let email: string | null = null
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${t.access_token}` },
      })
      if (r.ok) email = ((await r.json()) as { email?: string }).email ?? null
    } catch { /* opcional */ }

    const admin = createAdminClient()
    await admin.from('ga4_conexion').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await admin.from('ga4_conexion').insert({
      email,
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? null,
      expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
      scope: t.scope ?? null,
    })

    const res = NextResponse.redirect(new URL('/hub?ga4=ok', url.origin))
    res.cookies.delete('ga4_state')
    return res
  } catch (e) {
    console.error('[ga4 callback]', e)
    return NextResponse.redirect(new URL('/hub?ga4=error', url.origin))
  }
}
