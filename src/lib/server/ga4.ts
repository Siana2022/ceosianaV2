import { createAdminClient } from './supabase-admin'

const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

export function urlAutorizacion(redirectUri: string, state: string): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  u.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID ?? '')
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', SCOPES)
  u.searchParams.set('access_type', 'offline')
  u.searchParams.set('prompt', 'consent')   // fuerza refresh_token
  u.searchParams.set('include_granted_scopes', 'true')
  u.searchParams.set('state', state)
  return u.toString()
}

interface TokensGoogle {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
}

export async function canjearCodigo(code: string, redirectUri: string): Promise<TokensGoogle> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !(data as TokensGoogle).access_token) {
    throw new Error(`Google rechazó el código (${res.status})`)
  }
  return data as TokensGoogle
}

export async function renovar(refreshToken: string): Promise<TokensGoogle> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !(data as TokensGoogle).access_token) {
    throw new Error('La conexión con Google Analytics ha caducado. Vuelve a conectarla.')
  }
  return data as TokensGoogle
}

/** Devuelve un access token válido, renovándolo si hace falta. */
export async function tokenValido(): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('ga4_conexion')
    .select('id, access_token, refresh_token, expires_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const caduca = data.expires_at ? new Date(String(data.expires_at)).getTime() <= Date.now() + 60_000 : false
  if (!caduca) return String(data.access_token)

  if (!data.refresh_token) throw new Error('La conexión con Google Analytics ha caducado. Vuelve a conectarla.')
  const t = await renovar(String(data.refresh_token))
  await admin
    .from('ga4_conexion')
    .update({
      access_token: t.access_token,
      expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.id)
  return t.access_token
}

export interface PropiedadGA4 {
  propiedad: string      // "properties/123456789"
  nombre: string
  cuenta: string
}

/** Lista de propiedades a las que tiene acceso la cuenta conectada. */
export async function listarPropiedades(): Promise<PropiedadGA4[]> {
  const token = await tokenValido()
  if (!token) return []

  const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Google Analytics respondió ${res.status}: ${t.slice(0, 120)}`)
  }

  const data = await res.json().catch(() => ({})) as {
    accountSummaries?: {
      displayName?: string
      propertySummaries?: { property?: string; displayName?: string }[]
    }[]
  }

  const props: PropiedadGA4[] = []
  for (const cuenta of data.accountSummaries ?? []) {
    for (const p of cuenta.propertySummaries ?? []) {
      if (!p.property) continue
      props.push({
        propiedad: p.property,
        nombre: p.displayName ?? p.property,
        cuenta: cuenta.displayName ?? '',
      })
    }
  }
  return props.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export interface MetricasGA4 {
  sesiones: number
  usuarios: number
  usuariosProducto: number
  productosVistos: number
  usuariosCarrito: number
  carritos: number
  compras: number
  compradores: number
  articulosComprados: number
  ingresos: number
  aov: number | null
}

/** Métricas del embudo de compra para una propiedad y periodo. */
export async function metricasEmbudo(propiedad: string, desde: string, hasta: string): Promise<MetricasGA4> {
  const token = await tokenValido()
  if (!token) throw new Error('Google Analytics no está conectado')

  const metricas = [
    'sessions',
    'totalUsers',
    'addToCarts',
    'ecommercePurchases',
    'purchaseRevenue',
    'itemsPurchased',
  ]

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${propiedad}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: desde, endDate: hasta }],
      metrics: metricas.map(m => ({ name: m })),
    }),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Analytics respondió ${res.status}: ${t.slice(0, 120)}`)
  }

  const data = await res.json().catch(() => ({})) as {
    rows?: { metricValues?: { value?: string }[] }[]
  }
  const valores = (data.rows?.[0]?.metricValues ?? []).map(v => Number(v.value ?? 0))
  const [sesiones, usuarios, carritos, compras, ingresos, articulos] = [
    valores[0] ?? 0, valores[1] ?? 0, valores[2] ?? 0, valores[3] ?? 0, valores[4] ?? 0, valores[5] ?? 0,
  ]

  return {
    sesiones,
    usuarios,
    usuariosProducto: 0,
    productosVistos: 0,
    usuariosCarrito: 0,
    carritos,
    compras,
    compradores: compras,
    articulosComprados: articulos,
    ingresos: Number(ingresos.toFixed(2)),
    aov: compras > 0 ? Number((ingresos / compras).toFixed(2)) : null,
  }
}
