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

export interface HubTarea {
  id: string
  nombre: string
  estado: string
  fecha_limite: string | null
  id_servicio: string | null
  ids_responsables: string[] | null
}

export const ESTADO_LABEL: Record<string, string> = {
  espera: 'En espera',
  proceso: 'En proceso',
  bloqueada: 'Bloqueada',
  terminado: 'Terminada',
}

export const ESTADO_CLASE: Record<string, string> = {
  espera: 'bg-stone-200 text-stone-700',
  proceso: 'bg-blue-100 text-blue-800',
  bloqueada: 'bg-amber-100 text-amber-800',
  terminado: 'bg-green-100 text-green-800',
}

export interface HubAccion {
  id: string
  id_servicio: string
  fecha: string
  tipo: string
  titulo: string
  minutos: number | null
  empleado: { nombre: string } | { nombre: string }[] | null
}

export const TIPO_ACCION_LABEL: Record<string, string> = {
  optimizacion: 'Optimización',
  cambio: 'Cambio',
  incidencia: 'Incidencia',
  entrega: 'Entrega',
  nota: 'Nota',
}

export interface HubNota {
  id: string
  id_cliente: string
  id_servicio: string | null
  titulo: string
  contenido: string | null
  visibilidad: string
  created_at: string
  empleado: { nombre: string } | { nombre: string }[] | null
}

export interface HubProcesoFase {
  id: string
  nombre: string
  orden?: number
  estado: string
  fechaInicioPrevista?: string
  fechaFinPrevista?: string
  fechaCompletado?: string | null
  minutosAcumulados?: number
  [k: string]: unknown
}

export interface HubProceso {
  id: string
  nombre: string
  fases: HubProcesoFase[]
}

export interface HubEmpleado {
  id: string
  nombre: string
  avatar_url: string | null
}
