import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { listarHerramientas, renovarToken, llamarHerramienta, MCP_URL } from '@/lib/server/mcpGoogle'

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
  const tokenActual = String(con.access_token)


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

  // Pruebas en crudo contra el servidor MCP: status, cabecera de autenticación y cuerpo
  const cuerpoInit = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'ceosiana-diag', version: '1' } },
  }

  async function probar(etiqueta: string, conAuth: boolean, extra: Record<string, string> = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...extra,
    }
    if (conAuth) headers.Authorization = `Bearer ${tokenActual}`
    const r = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(cuerpoInit) })
    const t = await r.text()
    return {
      prueba: etiqueta,
      status: r.status,
      www_authenticate: r.headers.get('www-authenticate'),
      content_type: r.headers.get('content-type'),
      cuerpo: t.slice(0, 240),
    }
  }

  let pruebas: unknown[] = []
  try {
    pruebas = [
      await probar('bearer', true),
      await probar('bearer+protocol', true, { 'Mcp-Protocol-Version': '2025-06-18' }),
      await probar('sin-auth', false),
    ]
  } catch (e) {
    pruebas = [{ prueba: 'error', detalle: e instanceof Error ? e.message : String(e) }]
  }

  // Llamada real a la primera herramienta, para ver la forma de los datos
  let muestra: unknown = null
  try {
    const texto = await llamarHerramienta(tokenActual, 'customers_list_accessible_customers', {})
    muestra = texto.slice(0, 1200)
  } catch (e) {
    muestra = { error: e instanceof Error ? e.message : String(e) }
  }

  // Segunda llamada: la que usa el artefacto para listar cuentas
  let muestraBusqueda: unknown = null
  try {
    const texto = await llamarHerramienta(tokenActual, 'search_search', {
      customer_id: '2333383997',
      resource: 'customer_client',
      fields: [
        'customer_client.id',
        'customer_client.descriptive_name',
        'customer_client.manager',
        'customer_client.currency_code',
      ],
      conditions: ["customer_client.status = 'ENABLED'", 'customer_client.manager = FALSE'],
      orderings: [],
      login_customer_id: '2333383997',
    })
    muestraBusqueda = texto.slice(0, 1500)
  } catch (e) {
    muestraBusqueda = { error: e instanceof Error ? e.message : String(e) }
  }

  // Tercera llamada: anuncios con imagen, para ver si llega la URL
  let muestraImagenes: unknown = null
  try {
    const hoy = new Date()
    const hace90 = new Date(Date.now() - 90 * 86400000)
    const texto = await llamarHerramienta(tokenActual, 'search_search', {
      customer_id: '1420936873',
      resource: 'asset_group_asset',
      fields: [
        'asset.id',
        'asset.name',
        'asset.type',
        'asset.image_asset.full_size.url',
        'asset.image_asset.full_size.width_pixels',
        'asset.image_asset.full_size.height_pixels',
        'metrics.impressions',
      ],
      conditions: [
        `segments.date BETWEEN '${hace90.toISOString().slice(0, 10)}' AND '${hoy.toISOString().slice(0, 10)}'`,
        "asset.type IN ('IMAGE','YOUTUBE_VIDEO')",
      ],
      orderings: ['metrics.impressions DESC'],
      login_customer_id: '2333383997',
      limit: 3,
    })
    muestraImagenes = texto.slice(0, 1200)
  } catch (e) {
    muestraImagenes = { error: e instanceof Error ? e.message : String(e) }
  }

  // Intento 1: token actual
  try {
    const herramientas = await listarHerramientas(con.access_token as string)
    return NextResponse.json({ ...diagnostico, pruebas, muestra, muestraBusqueda, muestraImagenes, refrescado: false, herramientas })
  } catch (e1) {
    const msg1 = e1 instanceof Error ? e1.message : 'Error desconocido'

    // Intento 2: renovar y repetir
    if (!con.refresh_token) {
      return NextResponse.json({ ...diagnostico, pruebas, error: msg1, refrescado: false })
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
        pruebas,
        refrescado: true,
        herramientas,
        error_previo: msg1,
      })
    } catch (e2) {
      return NextResponse.json({
        ...diagnostico,
        pruebas,
        refrescado: false,
        error: msg1,
        error_refresh: e2 instanceof Error ? e2.message : 'Error al renovar',
      })
    }
  }
}
