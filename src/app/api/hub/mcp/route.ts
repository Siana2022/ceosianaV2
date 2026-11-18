import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { llamarHerramienta, renovarToken, MCP_URL } from '@/lib/server/mcpGoogle'

// Las imágenes de Google van a otro dominio y el artefacto las pide con fetch,
// así que el navegador las bloquea. Se reescriben a nuestro proxy del mismo origen.
function proxificarImagenes(texto: string): string {
  return texto.replace(
    /https:\/\/(?:tpc\.googlesyndication\.com|lh3\.googleusercontent\.com|i\.ytimg\.com)\/[^"\\\s]+/g,
    (url) => `/api/hub/imagen?url=${encodeURIComponent(url)}`,
  )
}

// POST /api/hub/mcp — puente entre el artefacto y el servidor MCP de Google Ads.
// El artefacto llama a mcp.callTool(servidor, herramienta, input) y aquí se
// reenvía con el token guardado en servidor. Solo lectura.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { server?: string; tool?: string; input?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Meta todavía no está conectado: se responde claro en vez de un 502 genérico
  if ((body.server ?? '').toLowerCase().includes('meta')) {
    return NextResponse.json(
      { error: 'Meta Ads todavía no está conectado en Ceosiana' },
      { status: 503 },
    )
  }

  const tool = body.tool
  if (!tool) return NextResponse.json({ error: 'Falta la herramienta' }, { status: 400 })

  const admin = createAdminClient()
  const { data: con } = await admin
    .from('mcp_conexiones')
    .select('proveedor, client_id, access_token, refresh_token, expires_at, token_endpoint')
    .eq('proveedor', 'google_ads')
    .maybeSingle()

  if (!con?.access_token) {
    return NextResponse.json(
      { error: 'Google Ads no está conectado. Conéctalo desde el hub.' },
      { status: 409 },
    )
  }

  let accessToken = con.access_token as string
  const expira = con.expires_at ? new Date(con.expires_at as string).getTime() : 0

  // Renovar si caduca en menos de un minuto
  if (expira && expira - Date.now() < 60_000 && con.refresh_token) {
    try {
      const t = await renovarToken({
        tokenEndpoint: con.token_endpoint as string,
        clientId: con.client_id as string,
        refreshToken: con.refresh_token as string,
      })
      accessToken = t.access_token
      await admin
        .from('mcp_conexiones')
        .update({
          access_token: t.access_token,
          expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('proveedor', 'google_ads')
    } catch (e) {
      console.error('[hub/mcp] no se pudo renovar el token:', e)
    }
  }

  try {
    let texto: string
    try {
      texto = await llamarHerramienta(accessToken, tool, body.input)
    } catch (e1) {
      // Si el token ha dejado de valer, se renueva y se reintenta una vez
      if (con.refresh_token && /401|invalid_token|unauthorized/i.test(String(e1))) {
        const t = await renovarToken({
          tokenEndpoint: con.token_endpoint as string,
          clientId: con.client_id as string,
          refreshToken: con.refresh_token as string,
        })
        accessToken = t.access_token
        await admin
          .from('mcp_conexiones')
          .update({
            access_token: t.access_token,
            expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('proveedor', 'google_ads')
        texto = await llamarHerramienta(accessToken, tool, body.input)
      } else {
        throw e1
      }
    }
    return NextResponse.json({ payload: proxificarImagenes(texto), cache: { storedAt: Date.now() } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al llamar al servidor MCP'
    // Un 401 indica que la conexión caducó: el cliente debe reconectar
    if (/401|invalid_token|unauthorized/i.test(msg)) {
      return NextResponse.json({ error: 'La conexión con Google Ads ha caducado. Vuelve a conectarla.', resource: MCP_URL }, { status: 401 })
    }
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
