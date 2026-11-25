import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { llamarConTokenGuardado } from '@/lib/server/mcpGoogle'
import { serieConMetricas } from '@/lib/server/ga4'
import { metricasCuenta } from '@/lib/server/meta'

// GET /api/informes/datos?id_cliente=&desde=&hasta=
// Devuelve métricas de Google Ads del cliente agrupadas por mes y por campaña.
export async function GET(req: NextRequest) {
  const perfil = await getPerfil()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const q = new URL(req.url).searchParams
  const idCliente = q.get('id_cliente')
  const f = q.get('fuente')
  const fuente = f === 'ga4' ? 'ga4' : f === 'meta_ads' ? 'meta_ads' : 'google_ads'
  const desde = q.get('desde') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const hasta = q.get('hasta') ?? new Date().toISOString().slice(0, 10)
  if (!idCliente) return NextResponse.json({ error: 'id_cliente requerido' }, { status: 400 })

  const supabase = await createClient()

  // ── GA4 ──────────────────────────────────────────────────────────────
  if (fuente === 'ga4') {
    const { data: cliente } = await supabase.from('clientes').select('ga4_propiedad').eq('id', idCliente).maybeSingle()
    const propiedad = (cliente as { ga4_propiedad?: string | null } | null)?.ga4_propiedad
    if (!propiedad) {
      return NextResponse.json({ totales: null, motivo: 'Este cliente no tiene GA4 vinculado', porMes: [], porCampana: [] })
    }
    const metricasPedidas = (q.get('metricas') ?? '')
      .split(',')
      .map(m => m.trim())
      .filter(Boolean)

    try {
      if (metricasPedidas.length > 0) {
        const { meses, totales } = await serieConMetricas(propiedad, desde, hasta, metricasPedidas)
        return NextResponse.json({
          fuente: 'ga4',
          periodo: { desde, hasta },
          totales,
          anterior: null,
          porMes: meses,
          porCampana: [],
        })
      }

      const base = await serieConMetricas(propiedad, desde, hasta, ['sessions', 'totalUsers', 'ecommercePurchases', 'purchaseRevenue'])
      return NextResponse.json({
        fuente: 'ga4',
        periodo: { desde, hasta },
        totales: base.totales,
        anterior: null,
        porMes: base.meses,
        porCampana: [],
      })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Error de Google Analytics' }, { status: 502 })
    }
  }

  // ── Meta Ads ─────────────────────────────────────────────────────────
  if (fuente === 'meta_ads') {
    if (!process.env.META_SYSTEM_USER_TOKEN) {
      return NextResponse.json({ totales: null, motivo: 'Falta el token de Meta en el servidor', porMes: [], porCampana: [] })
    }
    const { data: serviciosM } = await supabase.from('servicios').select('id').eq('id_cliente', idCliente)
    const idsM = (serviciosM ?? []).map(sv => sv.id)
    const { data: cuentasM } = idsM.length
      ? await supabase.from('cuenta_plataforma').select('id_externo, nombre')
          .in('id_servicio', idsM).eq('plataforma', 'meta_ads').eq('activa', true)
      : { data: [] }

    if (!cuentasM || cuentasM.length === 0) {
      return NextResponse.json({ totales: null, motivo: 'Este cliente no tiene cuenta de Meta vinculada', porMes: [], porCampana: [] })
    }

    try {
      const acumulado = { coste: 0, impresiones: 0, clics: 0, conversiones: 0, valor: 0 }
      const meses = new Map<string, Record<string, number>>()
      const campanas: Record<string, unknown>[] = []

      for (const c of cuentasM) {
        const r = await metricasCuenta(String(c.id_externo), desde, hasta)
        acumulado.coste += r.totales.coste
        acumulado.impresiones += r.totales.impresiones
        acumulado.clics += r.totales.clics
        acumulado.conversiones += r.totales.conversiones
        acumulado.valor += r.totales.valor
        for (const m of r.porMes) {
          const prev = meses.get(m.mes) ?? { coste: 0, impresiones: 0, clics: 0, conversiones: 0, valor: 0 }
          meses.set(m.mes, {
            coste: prev.coste + m.coste,
            impresiones: prev.impresiones + m.impresiones,
            clics: prev.clics + m.clics,
            conversiones: prev.conversiones + m.conversiones,
            valor: prev.valor + m.valor,
          })
        }
        campanas.push(...r.porCampana.map(x => ({ ...x, cuenta: c.nombre })))
      }

      const porMes = [...meses.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, v]) => ({
        mes,
        ...v,
        coste: Number(v.coste.toFixed(2)),
        conversiones: Number(v.conversiones.toFixed(2)),
        valor: Number(v.valor.toFixed(2)),
        cpa: v.conversiones > 0 ? Number((v.coste / v.conversiones).toFixed(2)) : null,
        roas: v.coste > 0 ? Number((v.valor / v.coste).toFixed(2)) : null,
        ctr: v.impresiones > 0 ? Number(((v.clics / v.impresiones) * 100).toFixed(2)) : null,
      }))

      return NextResponse.json({
        fuente: 'meta_ads',
        periodo: { desde, hasta },
        totales: {
          ...acumulado,
          coste: Number(acumulado.coste.toFixed(2)),
          conversiones: Number(acumulado.conversiones.toFixed(2)),
          valor: Number(acumulado.valor.toFixed(2)),
          cpa: acumulado.conversiones > 0 ? Number((acumulado.coste / acumulado.conversiones).toFixed(2)) : null,
          roas: acumulado.coste > 0 ? Number((acumulado.valor / acumulado.coste).toFixed(2)) : null,
          ctr: acumulado.impresiones > 0 ? Number(((acumulado.clics / acumulado.impresiones) * 100).toFixed(2)) : null,
        },
        anterior: null,
        porMes,
        porCampana: campanas.slice(0, 30),
      })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Error de Meta' }, { status: 502 })
    }
  }

  const { data: servicios } = await supabase.from('servicios').select('id').eq('id_cliente', idCliente)
  const ids = (servicios ?? []).map(s => s.id)
  if (ids.length === 0) return NextResponse.json({ totales: null, porMes: [], porCampana: [] })

  const { data: cuentas } = await supabase
    .from('cuenta_plataforma')
    .select('id_externo, nombre')
    .in('id_servicio', ids)
    .eq('plataforma', 'google_ads')
    .eq('activa', true)

  if (!cuentas || cuentas.length === 0) {
    return NextResponse.json({ totales: null, motivo: 'Sin cuenta de Google Ads vinculada', porMes: [], porCampana: [] })
  }


  const porMes = new Map<string, { impresiones: number; clics: number; coste: number; conversiones: number; valor: number }>()
  const porCampana: { campana: string; cuenta: string; impresiones: number; clics: number; coste: number; conversiones: number; valor: number }[] = []

  try {
    for (const cuenta of cuentas) {
      const texto = await llamarConTokenGuardado('search_search', {
        customer_id: cuenta.id_externo,
        resource: 'campaign',
        fields: [
          'campaign.name',
          'segments.month',
          'metrics.impressions',
          'metrics.clicks',
          'metrics.cost_micros',
          'metrics.conversions',
          'metrics.conversions_value',
        ],
        conditions: [`segments.date BETWEEN '${desde}' AND '${hasta}'`, 'metrics.impressions > 0'],
        orderings: ['metrics.cost_micros DESC'],
        login_customer_id: process.env.GOOGLE_ADS_MCC ?? '2333383997',
      })

      const filas = JSON.parse(texto) as Record<string, unknown>[]
      for (const f of filas) {
        const mes = String(f['segments.month'] ?? '').slice(0, 7)
        const i = Number(f['metrics.impressions'] ?? 0)
        const c = Number(f['metrics.clicks'] ?? 0)
        const gasto = Number(f['metrics.cost_micros'] ?? 0) / 1e6
        const conv = Number(f['metrics.conversions'] ?? 0)
        const valor = Number(f['metrics.conversions_value'] ?? 0)

        const acc = porMes.get(mes) ?? { impresiones: 0, clics: 0, coste: 0, conversiones: 0, valor: 0 }
        acc.impresiones += i; acc.clics += c; acc.coste += gasto; acc.conversiones += conv; acc.valor += valor
        porMes.set(mes, acc)

        porCampana.push({
          campana: String(f['campaign.name'] ?? ''),
          cuenta: cuenta.nombre,
          impresiones: i, clics: c, coste: gasto, conversiones: conv, valor,
        })
      }
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error de Google Ads' }, { status: 502 })
  }

  const meses = [...porMes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, m]) => ({
      mes,
      impresiones: m.impresiones,
      clics: m.clics,
      coste: Number(m.coste.toFixed(2)),
      conversiones: Number(m.conversiones.toFixed(2)),
      valor: Number(m.valor.toFixed(2)),
      cpa: m.conversiones >= 0.5 ? Number((m.coste / m.conversiones).toFixed(2)) : null,
      roas: m.coste > 0 ? Number((m.valor / m.coste).toFixed(2)) : null,
      ctr: m.impresiones > 0 ? Number(((m.clics / m.impresiones) * 100).toFixed(2)) : null,
    }))

  // Periodo anterior (misma duración, justo antes) para las variaciones
  const diasPeriodo = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1
  const hastaAnt = new Date(Date.parse(desde) - 86400000).toISOString().slice(0, 10)
  const desdeAnt = new Date(Date.parse(desde) - diasPeriodo * 86400000).toISOString().slice(0, 10)

  const acumuladoAnterior = { impresiones: 0, clics: 0, coste: 0, conversiones: 0, valor: 0 }
  try {
    for (const cuenta of cuentas) {
      const textoAnt = await llamarConTokenGuardado('search_search', {
        customer_id: cuenta.id_externo,
        resource: 'campaign',
        fields: [
          'metrics.impressions', 'metrics.clicks', 'metrics.cost_micros',
          'metrics.conversions', 'metrics.conversions_value',
        ],
        conditions: [`segments.date BETWEEN '${desdeAnt}' AND '${hastaAnt}'`, 'metrics.impressions > 0'],
        login_customer_id: process.env.GOOGLE_ADS_MCC ?? '2333383997',
      })
      const filasAnt = JSON.parse(textoAnt) as Record<string, unknown>[]
      for (const f of filasAnt) {
        acumuladoAnterior.impresiones += Number(f['metrics.impressions'] ?? 0)
        acumuladoAnterior.clics += Number(f['metrics.clicks'] ?? 0)
        acumuladoAnterior.coste += Number(f['metrics.cost_micros'] ?? 0) / 1e6
        acumuladoAnterior.conversiones += Number(f['metrics.conversions'] ?? 0)
        acumuladoAnterior.valor += Number(f['metrics.conversions_value'] ?? 0)
      }
    }
  } catch { /* si falla el periodo anterior, se devuelve sin variación */ }

  const totales = meses.reduce(
    (t, m) => ({
      impresiones: t.impresiones + m.impresiones,
      clics: t.clics + m.clics,
      coste: Number((t.coste + m.coste).toFixed(2)),
      conversiones: Number((t.conversiones + m.conversiones).toFixed(2)),
      valor: Number((t.valor + m.valor).toFixed(2)),
    }),
    { impresiones: 0, clics: 0, coste: 0, conversiones: 0, valor: 0 },
  )

  porCampana.sort((a, b) => b.coste - a.coste)

  return NextResponse.json({
    periodo: { desde, hasta },
    totales: {
      ...totales,
      cpa: totales.conversiones >= 0.5 ? Number((totales.coste / totales.conversiones).toFixed(2)) : null,
      roas: totales.coste > 0 ? Number((totales.valor / totales.coste).toFixed(2)) : null,
      ctr: totales.impresiones > 0 ? Number(((totales.clics / totales.impresiones) * 100).toFixed(2)) : null,
    },
    porMes: meses,
    anterior: {
      ...acumuladoAnterior,
      coste: Number(acumuladoAnterior.coste.toFixed(2)),
      conversiones: Number(acumuladoAnterior.conversiones.toFixed(2)),
      valor: Number(acumuladoAnterior.valor.toFixed(2)),
      cpa: acumuladoAnterior.conversiones >= 0.5 ? Number((acumuladoAnterior.coste / acumuladoAnterior.conversiones).toFixed(2)) : null,
      roas: acumuladoAnterior.coste > 0 ? Number((acumuladoAnterior.valor / acumuladoAnterior.coste).toFixed(2)) : null,
      ctr: acumuladoAnterior.impresiones > 0 ? Number(((acumuladoAnterior.clics / acumuladoAnterior.impresiones) * 100).toFixed(2)) : null,
    },
    porCampana: porCampana.slice(0, 30).map(c => ({
      ...c,
      coste: Number(c.coste.toFixed(2)),
      conversiones: Number(c.conversiones.toFixed(2)),
      valor: Number(c.valor.toFixed(2)),
      cpa: c.conversiones >= 0.5 ? Number((c.coste / c.conversiones).toFixed(2)) : null,
      roas: c.coste > 0 ? Number((c.valor / c.coste).toFixed(2)) : null,
    })),
  })
}
