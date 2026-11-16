import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { listarHerramientas, renovarToken, MCP_URL } from '@/lib/server/mcpGoogle'

// GET /api/hub/mcp/estado — diagnóstico de la conexión con Google Ads.
// Lista las herramientas que expone el servidor MCP para comprobar nombres.
export async function GET() {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: con } = await admin
    .from('mcp_conexiones')
    .select('proveedor, client_id, access_token, refresh_token, expires_at, scopes, token_endpoint, updated_at')
    .eq('proveedor', 'google_ads')
    .maybeSingle()

  if (!con?.access_token) {
    return NextResponse.json({ conectado: false })
  }

  // Lectura del JWT (sin verificar) para ver audiencia y emisor
  let jwt: Record<string, unknown> | null = null
  try {
    const partes = String(con.access_token).split('.')
    if (partes.length === 3) {
      jwt = JSON.parse(Buffer.from(partes[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    }
  } catch { jwt = null }

  const diagnostico = {
    jwt: jwt ? { aud: jwt.aud ?? null, iss: jwt.iss ?? null, exp: jwt.exp ?? null, scope: jwt.scope ?? jwt.scp ?? null, client_id: jwt.client_id ?? jwt.azp ?? null } : null,
    conectado: true,
    caduca: con.expires_at,
    caducado: con.expires_at ? new Date(con.expires_at as string).getTime() < Date.now() : null,
    scopes: con.scopes,
    recurso_esperado: MCP_URL,
    tiene_refresh: Boolean(con.refresh_token),
    longitud_token: String(con.access_token).length,
    actualizado: con.updated_at,
  }

  // Intento 1: token actual
  try {
    const herramientas = await listarHerramientas(con.access_token as string)
    return NextResponse.json({ ...diagnostico, refrescado: false, herramientas })
  } catch (e1) {
    const msg1 = e1 instanceof Error ? e1.message : 'Error desconocido'

    // Intento 2: renovar y repetir
    if (!con.refresh_token) {
      return NextResponse.json({ ...diagnostico, error: msg1, refrescado: false })
    }
    try {
      const t = await renovarToken({
        tokenEndpoint: con.token_endpoint as string,
        clientId: con.client_id as string,
        refreshToken: con.refresh_token as string,
      })
      await admin
        .from('mcp_conexiones')
        .update({
          access_token: t.access_token,
          expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('proveedor', 'google_ads')

      const herramientas = await listarHerramientas(t.access_token)
      return NextResponse.json({
        ...diagnostico,
        refrescado: true,
        herramientas,
        error_previo: msg1,
      })
    } catch (e2) {
      return NextResponse.json({
        ...diagnostico,
        refrescado: false,
        error: msg1,
        error_refresh: e2 instanceof Error ? e2.message : 'Error al renovar',
      })
    }
  }
}
