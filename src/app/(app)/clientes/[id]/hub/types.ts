export interface HubServicio {
  id: string
  nombre: string
  tipo_servicio: { id: string; nombre: string } | { id: string; nombre: string }[] | null
}

export interface HubCuenta {
  id: string
  id_servicio: string
  plataforma: string
  id_externo: string
  nombre: string
  moneda: string
  activa: boolean
  ultima_sync: string | null
}

export type Plataforma = 'google_ads' | 'meta_ads' | 'ga4'

export const PLATAFORMA_LABEL: Record<Plataforma, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  ga4: 'Analítica (GA4)',
}

export const PLATAFORMA_ICONO: Record<Plataforma, string> = {
  google_ads: '🟦',
  meta_ads: '🟪',
  ga4: '🟧',
}

/** Deduce la plataforma a partir del nombre del tipo de servicio. */
export function plataformaDe(tipo?: string | null): Plataforma | null {
  const t = (tipo ?? '').toLowerCase()
  if (t.includes('google ads')) return 'google_ads'
  if (t.includes('meta')) return 'meta_ads'
  if (t.includes('anal') || t.includes('ga4')) return 'ga4'
  return null
}

export function nombreTipo(s: HubServicio): string {
  const t = s.tipo_servicio
  if (!t) return ''
  return Array.isArray(t) ? (t[0]?.nombre ?? '') : t.nombre
}
