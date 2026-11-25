// Puente con la API de Marketing de Meta.
// El artefacto pide cuatro "herramientas"; aquí se traducen a llamadas Graph.

const VERSION = process.env.META_GRAPH_VERSION || 'v21.0'
const BASE = `https://graph.facebook.com/${VERSION}`

function token() {
  const t = process.env.META_SYSTEM_USER_TOKEN
  if (!t) throw new Error('Falta META_SYSTEM_USER_TOKEN en el servidor')
  return t
}

async function graph(path: string, params: Record<string, string | undefined> = {}) {
  const url = new URL(`${BASE}/${path.replace(/^\//, '')}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v)
  }
  url.searchParams.set('access_token', token())

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = (data as { error?: { message?: string } }).error
    throw new Error(err?.message ?? `Graph ${res.status}`)
  }
  return data as {
    data?: unknown[]
    paging?: { cursors?: { after?: string }; next?: string }
    [k: string]: unknown
  }
}

interface FilaMeta {
  [k: string]: unknown
}

function accion(lista: unknown, tipo: string): number {
  if (!Array.isArray(lista)) return 0
  const found = (lista as { action_type?: string; value?: string }[]).find(a => a.action_type === tipo)
  return found ? Number(found.value ?? 0) : 0
}

function valorAccion(lista: unknown, tipo: string): number {
  if (!Array.isArray(lista)) return 0
  const found = (lista as { action_type?: string; value?: string }[]).find(a => a.action_type === tipo)
  return found ? Number(found.value ?? 0) : 0
}

function roas(lista: unknown): number {
  if (!Array.isArray(lista) || lista.length === 0) return 0
  return Number((lista[0] as { value?: string }).value ?? 0)
}

/** Cuentas publicitarias accesibles con el token de sistema. */
export async function cuentasAnuncios(limit = 100, after?: string) {
  const r = await graph('me/adaccounts', {
    fields: 'account_id,name,currency,account_status',
    limit: String(limit),
    after,
  })
  const filas = (r.data ?? []) as { account_id?: string; name?: string; currency?: string; account_status?: number }[]
  return {
    ad_accounts: filas.map(a => ({
      ad_account_id: String(a.account_id ?? ''),
      ad_account_name: a.name ?? '',
      currency: a.currency ?? 'EUR',
      account_status: a.account_status ?? 1,
    })),
    next_cursor: r.paging?.cursors?.after ?? null,
  }
}

/** Anuncios de una cuenta con sus métricas, en el formato que espera el artefacto. */
export async function entidadesAnuncio(input: Record<string, unknown>) {
  const cuenta = String(input.ad_account_id ?? '').replace(/^act_/, '')
  if (!cuenta) throw new Error('ad_account_id requerido')

  const limit = Number(input.limit ?? 100)
  const after = typeof input.cursor === 'string' ? input.cursor : undefined

  let since = ''
  let until = ''
  try {
    const tr = typeof input.time_range === 'string' ? JSON.parse(input.time_range) : input.time_range
    since = (tr as { since?: string }).since ?? ''
    until = (tr as { until?: string }).until ?? ''
  } catch {
    // sin rango: Meta devuelve el máximo disponible
  }

  // 1) Anuncios: aportan creatividad, objetivo y estado
  const ads = await graph(`act_${cuenta}/ads`, {
    fields: 'id,name,creative{id},campaign_id,campaign_name,adset_id,adset_name,status,effective_status,objective',
    limit: String(Math.min(limit, 100)),
    after,
    filtering: undefined,
  })

  const listaAds = (ads.data ?? []) as Record<string, unknown>[]
  const ids = listaAds.map(a => String(a.id))

  // 2) Métricas del periodo
  let insights: Record<string, unknown>[] = []
  if (ids.length) {
    const ins = await graph(`act_${cuenta}/insights`, {
      level: 'ad',
      fields: 'ad_id,spend,impressions,clicks,inline_link_clicks,ctr,frequency,actions,action_values,purchase_roas,video_play_actions',
      time_range: since && until ? JSON.stringify({ since, until }) : undefined,
      limit: String(Math.min(limit, 100)),
      filtering: JSON.stringify([{ field: 'ad_id', operator: 'IN', value: ids }]),
    })
    insights = (ins.data ?? []) as Record<string, unknown>[]
  }

  const porAnuncio = new Map(insights.map(i => [String(i.ad_id), i]))

  const filas: FilaMeta[] = listaAds.map(a => {
    const creative = a.creative as { id?: string } | undefined
    const m = porAnuncio.get(String(a.id)) ?? {}
    const spend = Number(m.spend ?? 0)
    const conv = accion(m.actions, 'omni_purchase')

    return {
      id: String(a.id),
      name: String(a.name ?? a.id),
      creative_id: String(creative?.id ?? ''),
      campaign_id: String(a.campaign_id ?? ''),
      campaign_name: String(a.campaign_name ?? ''),
      adset_id: String(a.adset_id ?? ''),
      adset_name: String(a.adset_name ?? ''),
      objective: String(a.objective ?? ''),
      effective_status: String(a.effective_status ?? a.status ?? ''),
      amount_spent: spend.toFixed(2),
      impressions: String(m.impressions ?? '0'),
      link_click: String(m.inline_link_clicks ?? m.clicks ?? '0'),
      ctr: String(m.ctr ?? '0'),
      frequency: String(m.frequency ?? '0'),
      omni_purchase: String(conv),
      omni_purchase_values: String(valorAccion(m.action_values, 'omni_purchase')),
      purchase_roas: String(roas(m.purchase_roas)),
      video_play_actions: String(accion(m.video_play_actions as unknown, 'video_view')),
      results: String(conv),
      cost_per_result: conv > 0 ? (spend / conv).toFixed(2) : '',
    }
  })

  return {
    ad_entities: filas,
    pagination: { next_cursor: ads.paging?.cursors?.after ?? null },
  }
}

/** Creatividades por id (imagen, vídeo, título, texto…). */
export async function creatividades(input: Record<string, unknown>) {
  const ids = (input.creative_ids as string[] | undefined) ?? []
  if (!ids.length) return { ad_creatives: [] }

  const campos = 'id,object_type,title,body,call_to_action_type,video_id,image_url,thumbnail_url,child_attachments,product_set_id'
  const out: Record<string, unknown>[] = []

  // La Graph API permite pedir varios ids con ?ids=
  for (let i = 0; i < ids.length; i += 50) {
    const lote = ids.slice(i, i + 50)
    const r = await graph('', { ids: lote.join(','), fields: campos })
    for (const [id, valor] of Object.entries(r)) {
      if (id === 'data' || !valor) continue
      out.push({ id, ...(valor as Record<string, unknown>) })
    }
  }

  return { ad_creatives: out }
}

/** Vista previa de un anuncio (HTML de Meta). */
export async function vistaPrevia(input: Record<string, unknown>) {
  const adId = String(input.ad_id ?? '')
  if (!adId) return { preview_url: null }
  const r = await graph(`${adId}/previews`, { ad_format: 'DESKTOP_FEED_STANDARD' })
  const lista = (r.data ?? []) as { body?: string }[]
  return { preview_url: null, previews: lista }
}

export interface FilaMesMeta {
  mes: string
  coste: number
  impresiones: number
  clics: number
  conversiones: number
  valor: number
  cpa: number | null
  roas: number | null
  ctr: number | null
}

/** Métricas de una cuenta publicitaria por mes y por campaña. */
export async function metricasCuenta(cuenta: string, since: string, until: string) {
  const id = cuenta.replace(/^act_/, '')

  // Serie mensual
  const insMes = await graph(`act_${id}/insights`, {
    level: 'account',
    fields: 'spend,impressions,clicks,ctr,actions,action_values,purchase_roas',
    time_range: JSON.stringify({ since, until }),
    time_increment: 'monthly',
    limit: '200',
  })

  const filas = (insMes.data ?? []) as Record<string, unknown>[]
  const porMes: FilaMesMeta[] = filas.map(f => {
    const coste = Number(f.spend ?? 0)
    const conv = accion(f.actions, 'omni_purchase')
    const valor = valorAccion(f.action_values, 'omni_purchase')
    const imp = Number(f.impressions ?? 0)
    const clics = Number(f.clicks ?? 0)
    return {
      mes: String(f.date_start ?? '').slice(0, 7),
      coste: Number(coste.toFixed(2)),
      impresiones: imp,
      clics,
      conversiones: Number(conv.toFixed(2)),
      valor: Number(valor.toFixed(2)),
      cpa: conv > 0 ? Number((coste / conv).toFixed(2)) : null,
      roas: coste > 0 ? Number((valor / coste).toFixed(2)) : null,
      ctr: imp > 0 ? Number(((clics / imp) * 100).toFixed(2)) : null,
    }
  }).sort((a, b) => a.mes.localeCompare(b.mes))

  const totales = porMes.reduce(
    (t, m) => ({
      coste: Number((t.coste + m.coste).toFixed(2)),
      impresiones: t.impresiones + m.impresiones,
      clics: t.clics + m.clics,
      conversiones: Number((t.conversiones + m.conversiones).toFixed(2)),
      valor: Number((t.valor + m.valor).toFixed(2)),
    }),
    { coste: 0, impresiones: 0, clics: 0, conversiones: 0, valor: 0 },
  )

  // Campañas del periodo
  let porCampana: Record<string, unknown>[] = []
  try {
    const insCamp = await graph(`act_${id}/insights`, {
      level: 'campaign',
      fields: 'campaign_name,spend,impressions,clicks,actions,action_values',
      time_range: JSON.stringify({ since, until }),
      limit: '100',
    })
    porCampana = ((insCamp.data ?? []) as Record<string, unknown>[]).map(c => {
      const coste = Number(c.spend ?? 0)
      const conv = accion(c.actions, 'omni_purchase')
      const valor = valorAccion(c.action_values, 'omni_purchase')
      return {
        campana: String(c.campaign_name ?? ''),
        coste: Number(coste.toFixed(2)),
        conversiones: Number(conv.toFixed(2)),
        cpa: conv > 0 ? Number((coste / conv).toFixed(2)) : null,
        roas: coste > 0 ? Number((valor / coste).toFixed(2)) : null,
      }
    }).sort((a, b) => Number(b.coste) - Number(a.coste))
  } catch { /* sin campañas */ }

  return {
    porMes,
    totales: {
      ...totales,
      cpa: totales.conversiones > 0 ? Number((totales.coste / totales.conversiones).toFixed(2)) : null,
      roas: totales.coste > 0 ? Number((totales.valor / totales.coste).toFixed(2)) : null,
      ctr: totales.impresiones > 0 ? Number(((totales.clics / totales.impresiones) * 100).toFixed(2)) : null,
    },
    porCampana,
  }
}
