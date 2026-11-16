import crypto from 'crypto'

// Servidor MCP de Google Ads de Siana (Google Cloud Run).
export const MCP_URL = process.env.GOOGLE_ADS_MCP_URL
  || 'https://google-ads-mcp-847027650333.europe-west1.run.app/mcp'

const BASE = MCP_URL.replace(/\/mcp\/?$/, '')

export interface MetadataOAuth {
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint: string
  scopes_supported?: string[]
}

let cacheMeta: MetadataOAuth | null = null

/** Lee la configuración OAuth del servidor (y la cachea en memoria). */
export async function metadata(): Promise<MetadataOAuth> {
  if (cacheMeta) return cacheMeta
  const res = await fetch(`${BASE}/.well-known/oauth-authorization-server`)
  if (!res.ok) throw new Error(`No se pudo leer la configuración OAuth (${res.status})`)
  cacheMeta = (await res.json()) as MetadataOAuth
  return cacheMeta
}

export function baseUrl() {
  return BASE
}

/** Registro dinámico del cliente (RFC 7591). Devuelve el client_id público. */
export async function registrarCliente(redirectUri: string): Promise<string> {
  const meta = await metadata()
  const res = await fetch(meta.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Ceosiana Hub',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/adwords',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Registro del cliente falló: ${(data as { error?: string }).error ?? res.status}`)
  }
  const id = (data as { client_id?: string }).client_id
  if (!id) throw new Error('El registro no devolvió client_id')
  return id
}

export function base64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function crearPkce() {
  const verifier = base64url(crypto.randomBytes(32))
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export function estadoAleatorio() {
  return base64url(crypto.randomBytes(16))
}

export function urlAutorizacion(opts: {
  authorizationEndpoint: string
  clientId: string
  redirectUri: string
  state: string
  challenge: string
}) {
  const u = new URL(opts.authorizationEndpoint)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', opts.clientId)
  u.searchParams.set('redirect_uri', opts.redirectUri)
  u.searchParams.set('state', opts.state)
  u.searchParams.set('code_challenge', opts.challenge)
  u.searchParams.set('code_challenge_method', 'S256')
  u.searchParams.set('scope', 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/adwords')
  u.searchParams.set('resource', MCP_URL)
  return u.toString()
}

export interface Tokens {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
}

export async function canjearCodigo(opts: {
  tokenEndpoint: string
  clientId: string
  redirectUri: string
  code: string
  verifier: string
}): Promise<Tokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: opts.clientId,
    code_verifier: opts.verifier,
    resource: MCP_URL,
  })
  const res = await fetch(opts.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !(data as Tokens).access_token) {
    const err = (data as { error?: string; error_description?: string })
    throw new Error(`No se pudo obtener el token: ${err.error ?? res.status} ${err.error_description ?? ''}`)
  }
  return data as Tokens
}

export async function renovarToken(opts: {
  tokenEndpoint: string
  clientId: string
  refreshToken: string
}): Promise<Tokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    resource: MCP_URL,
  })
  const res = await fetch(opts.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !(data as Tokens).access_token) {
    throw new Error(`No se pudo renovar el token (${res.status})`)
  }
  return data as Tokens
}

/** Interpreta una respuesta MCP, que puede ser JSON o SSE. */
function leerRespuesta(texto: string): unknown {
  const lineas = texto.split('\n')
  const datos = lineas.filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).filter(Boolean)
  const cuerpo = datos.length ? datos[datos.length - 1] : texto
  return JSON.parse(cuerpo)
}

interface RespuestaRpc {
  sesion: string | null
  data: unknown
}

async function rpc(
  accessToken: string,
  body: Record<string, unknown>,
  sesion?: string | null,
): Promise<RespuestaRpc> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${accessToken}`,
  }
  if (sesion) headers['Mcp-Session-Id'] = sesion

  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) })
  const nuevaSesion = res.headers.get('mcp-session-id') ?? sesion ?? null
  const texto = await res.text()

  if (!res.ok) throw new Error(`MCP ${res.status}: ${texto.slice(0, 300)}`)
  if (!texto.trim()) return { sesion: nuevaSesion, data: null }

  try {
    return { sesion: nuevaSesion, data: leerRespuesta(texto) }
  } catch {
    throw new Error(`Respuesta MCP no interpretable: ${texto.slice(0, 200)}`)
  }
}

/** Abre una sesión MCP (initialize + initialized). */
async function abrirSesion(accessToken: string): Promise<string | null> {
  const init = await rpc(accessToken, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'ceosiana-hub', version: '1.0.0' },
    },
  })

  const err = (init.data as { error?: { message?: string } } | null)?.error
  if (err) throw new Error(err.message ?? 'initialize falló')

  if (init.sesion) {
    await rpc(accessToken, { jsonrpc: '2.0', method: 'notifications/initialized' }, init.sesion)
  }
  return init.sesion
}

/** Lista las herramientas que expone el servidor MCP. */
export async function listarHerramientas(accessToken: string): Promise<string[]> {
  const sesion = await abrirSesion(accessToken)
  const res = await rpc(accessToken, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, sesion)
  const tools = (res.data as { result?: { tools?: { name: string }[] } } | null)?.result?.tools ?? []
  return tools.map(t => t.name)
}

/** Llama a una herramienta del MCP y devuelve el texto de la respuesta. */
export async function llamarHerramienta(accessToken: string, tool: string, input: unknown): Promise<string> {
  const sesion = await abrirSesion(accessToken)
  const res = await rpc(
    accessToken,
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: tool, arguments: input ?? {} },
    },
    sesion,
  )

  const rpcData = res.data as {
    error?: { message?: string }
    result?: { content?: { text?: string }[]; isError?: boolean }
  } | null

  if (rpcData?.error) throw new Error(rpcData.error.message ?? 'Error del servidor MCP')

  const partes = rpcData?.result?.content ?? []
  const texto = partes.map(p => p.text ?? '').join('\n')
  if (rpcData?.result?.isError) throw new Error(texto || 'La herramienta devolvió un error')
  return texto
}
