import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { llamarHerramienta } from '@/lib/server/mcpGoogle'

// GET /api/informes/datos?id_cliente=&desde=&hasta=
// Devuelve métricas de Google Ads del cliente agrupadas por mes y por campaña.
export async function GET(req: NextRequest) {
  const perfil = await getPerfil()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const q = new URL(req.url).searchParams
  const idCliente = q.get('id_cliente')
  const desde = q.get('desde') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const hasta = q.get('hasta') ?? new Date().toISOString().slice(0, 10)
  if (!idCliente) return NextResponse.json({ error: 'id_cliente requerido' }, { status: 400 })

  const supabase = await createClient()
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

  const admin = createAdminClient()
  const { data: conexion } = await admin.from('mcp_conexiones').select('access_token').eq('proveedor', 'google_ads').maybeSingle()
  if (!conexion?.access_token) {
    return NextResponse.json({ totales: null, motivo: 'Google Ads no conectado', porMes: [], porCampana: [] })
  }

  const token = String(conexion.access_token)
  const porMes = new Map<string, { impresiones: number; clics: number; coste: number; conversiones: number; valor: number }>()
  const porCampana: { campana: string; cuenta: string; impresiones: number; clics: number; coste: number; conversiones: number; valor: number }[] = []

  try {
    for (const cuenta of cuentas) {
      const texto = await llamarHerramienta(token, 'search_search', {
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
        login_customer_id: cuenta.id_externo,
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
