import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { canjearCodigo, MCP_URL } from '@/lib/server/mcpGoogle'

// GET /api/hub/mcp/callback — vuelta del OAuth de Google Ads
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const origin = url.origin
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) return NextResponse.redirect(`${origin}/hub?google=denegado`)

  const cookieStore = await cookies()
  const raw = cookieStore.get('mcp_oauth')?.value
  cookieStore.delete('mcp_oauth')

  if (!raw) return NextResponse.redirect(`${origin}/hub?google=sin_estado`)
  if (!code) return NextResponse.redirect(`${origin}/hub?google=sin_codigo`)

  let datos: {
    clientId: string
    verifier: string
    state: string
    redirectUri: string
    tokenEndpoint: string
    authorizationEndpoint: string
  }
  try {
    datos = JSON.parse(raw)
  } catch {
    return NextResponse.redirect(`${origin}/hub?google=estado_corrupto`)
  }

  if (state !== datos.state) return NextResponse.redirect(`${origin}/hub?google=estado_invalido`)

  try {
    const tokens = await canjearCodigo({
      tokenEndpoint: datos.tokenEndpoint,
      clientId: datos.clientId,
      redirectUri: datos.redirectUri,
      code,
      verifier: datos.verifier,
    })

    const admin = createAdminClient()
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    const { error: dbError } = await admin.from('mcp_conexiones').upsert(
      {
        proveedor: 'google_ads',
        client_id: datos.clientId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
        scopes: tokens.scope ?? null,
        resource: MCP_URL,
        token_endpoint: datos.tokenEndpoint,
        authorization_endpoint: datos.authorizationEndpoint,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'proveedor' },
    )

    if (dbError) {
      return NextResponse.redirect(`${origin}/hub?google=error_db&msg=${encodeURIComponent(dbError.message)}`)
    }

    return NextResponse.redirect(`${origin}/hub?google=ok`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al canjear el código'
    return NextResponse.redirect(`${origin}/hub?google=error&msg=${encodeURIComponent(msg)}`)
  }
}
