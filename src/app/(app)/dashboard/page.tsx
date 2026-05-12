import { createClient } from '@/lib/server/supabase'
import EvolucionChart from '@/components/EvolucionChart'
import BeneficioChart from '@/components/BeneficioChart'
import AlertasPanel from '@/components/AlertasPanel'

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; mes?: string }>
}) {
  const { year: yearParam, mes: mesParam } = await searchParams
  const year = parseInt(yearParam ?? String(new Date().getFullYear()))
  const mes = mesParam ? parseInt(mesParam) : null

  const supabase = await createClient()

  // Always fetch full year for charts; filter for KPIs client-side
  const [
    { data: ingresosAno },
    { data: sueldosAno },
    { data: gastosAno },
    { data: clientes },
  ] = await Promise.all([
    supabase.from('ingresos').select('valor, mes, anio, id_cliente').eq('anio', year),
    supabase.from('sueldos').select('coste_total, mes, anio').eq('anio', year),
    supabase.from('gastos_fijos').select('valor, mes, anio').eq('anio', year),
    supabase.from('clientes').select('id, nombre'),
  ])

  // KPIs: filter by month if selected
  const ingresosPeriod = mes ? (ingresosAno ?? []).filter(r => r.mes === mes) : (ingresosAno ?? [])
  const sueldosPeriod  = mes ? (sueldosAno  ?? []).filter(r => r.mes === mes) : (sueldosAno  ?? [])
  const gastosPeriod   = mes ? (gastosAno   ?? []).filter(r => r.mes === mes) : (gastosAno   ?? [])

  const totalFacturacion = ingresosPeriod.reduce((s, r) => s + Number(r.valor), 0)
  const totalSueldos     = sueldosPeriod.reduce((s, r)  => s + Number(r.coste_total), 0)
  const totalGastos      = gastosPeriod.reduce((s, r)   => s + Number(r.valor), 0)
  const totalCostes      = totalSueldos + totalGastos
  const beneficio        = totalFacturacion - totalCostes
  const margen_pct       = totalFacturacion > 0 ? (beneficio / totalFacturacion) * 100 : 0

  // Monthly breakdown for charts (always full year)
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const facMes  = (ingresosAno ?? []).filter(r => r.mes === m).reduce((s, r) => s + Number(r.valor), 0)
    const sueMes  = (sueldosAno  ?? []).filter(r => r.mes === m).reduce((s, r) => s + Number(r.coste_total), 0)
    const gasMes  = (gastosAno   ?? []).filter(r => r.mes === m).reduce((s, r) => s + Number(r.valor), 0)
    const costesMes = sueMes + gasMes
    const resultadoMes = facMes - costesMes
    const margenMes = facMes > 0 ? (resultadoMes / facMes) * 100 : 0
    return {
      mes: MESES_CORTO[i],
      facturacion: facMes,
      gastosFijos: gasMes,
      sueldos: sueMes,
      costes: costesMes,
      beneficio: resultadoMes,
      margen: margenMes,
    }
  })

  // Revenue by client
  const clienteMap = new Map((clientes ?? []).map(c => [c.id, c.nombre]))
  const revByClient = new Map<string, number>()
  for (const r of ingresosPeriod) {
    if (!r.id_cliente) continue
    revByClient.set(r.id_cliente, (revByClient.get(r.id_cliente) ?? 0) + Number(r.valor))
  }
  const topClientes = [...revByClient.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, valor]) => ({ nombre: clienteMap.get(id) ?? id, valor }))

  const periodLabel = mes ? `${MESES_CORTO[mes - 1]} ${year}` : `Año ${year}`
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-gray-400 mt-1 text-sm">{periodLabel}</p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {years.map(y => (
            <a key={y} href={`/dashboard?year=${y}${mes ? `&mes=${mes}` : ''}`}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${y === year ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
              {y}
            </a>
          ))}
          <span className="text-gray-600">|</span>
          <a href={`/dashboard?year=${year}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${!mes ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
            Todo el año
          </a>
          {MESES_CORTO.map((m, i) => (
            <a key={i} href={`/dashboard?year=${year}&mes=${i + 1}`}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${mes === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
              {m}
            </a>
          ))}
        </div>
      </div>

      {/* Alertas (solo admins) */}
      <AlertasPanel />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Facturación</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(totalFacturacion)}</p>
          <p className="text-gray-500 text-xs mt-1">{periodLabel}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Costes totales</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(totalCostes)}</p>
          <p className="text-gray-500 text-xs mt-1">Sueldos {fmt(totalSueldos)} · Gastos {fmt(totalGastos)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Beneficio</p>
          <p className={`text-2xl font-bold mt-1 ${beneficio >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(beneficio)}</p>
          <p className="text-gray-500 text-xs mt-1">{periodLabel}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Margen</p>
          <p className={`text-2xl font-bold mt-1 ${margen_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{margen_pct.toFixed(1)}%</p>
          <p className="text-gray-500 text-xs mt-1">sobre facturación</p>
        </div>
      </div>

      {/* Charts */}
      <EvolucionChart data={porMes} />
      <BeneficioChart data={porMes} />

      {/* Monthly P&L table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">P&amp;L mensual — {year}</h3>
          <p className="text-gray-500 text-xs mt-0.5">Ingresos, costes y resultado por mes</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-4 py-3">Mes</th>
                <th className="text-right px-4 py-3">Ingresos</th>
                <th className="text-right px-4 py-3">Gastos Fijos</th>
                <th className="text-right px-4 py-3">Sueldos</th>
                <th className="text-right px-4 py-3">Costes Total</th>
                <th className="text-right px-4 py-3">Resultado</th>
                <th className="text-right px-4 py-3">Margen %</th>
              </tr>
            </thead>
            <tbody>
              {porMes.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-gray-300 font-medium">{row.mes}</td>
                  <td className="px-4 py-3 text-right text-white">{fmt(row.facturacion)}</td>
                  <td className="px-4 py-3 text-right text-orange-400">{fmt(row.gastosFijos)}</td>
                  <td className="px-4 py-3 text-right text-orange-400">{fmt(row.sueldos)}</td>
                  <td className="px-4 py-3 text-right text-red-400">{fmt(row.costes)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${row.beneficio >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmt(row.beneficio)}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${row.margen >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {row.facturacion > 0 ? `${row.margen.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-700 bg-gray-800/50">
                <td className="px-4 py-3 text-white font-bold">Total</td>
                <td className="px-4 py-3 text-right text-white font-bold">{fmt(totalFacturacion)}</td>
                <td className="px-4 py-3 text-right text-orange-400 font-bold">{fmt(totalGastos)}</td>
                <td className="px-4 py-3 text-right text-orange-400 font-bold">{fmt(totalSueldos)}</td>
                <td className="px-4 py-3 text-right text-red-400 font-bold">{fmt(totalCostes)}</td>
                <td className={`px-4 py-3 text-right font-bold ${beneficio >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmt(beneficio)}
                </td>
                <td className={`px-4 py-3 text-right font-bold ${margen_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalFacturacion > 0 ? `${margen_pct.toFixed(1)}%` : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Top clients table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Top clientes por facturación</h3>
          <p className="text-gray-500 text-xs mt-0.5">{periodLabel}</p>
        </div>
        {topClientes.length === 0 ? (
          <p className="text-gray-500 text-sm p-6">Sin datos para el período seleccionado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-6 py-3">#</th>
                <th className="text-left px-6 py-3">Cliente</th>
                <th className="text-right px-6 py-3">Facturación</th>
                <th className="text-right px-6 py-3">% del total</th>
              </tr>
            </thead>
            <tbody>
              {topClientes.map(({ nombre, valor }, idx) => (
                <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-6 py-3 text-gray-500">{idx + 1}</td>
                  <td className="px-6 py-3 text-white font-medium">{nombre}</td>
                  <td className="px-6 py-3 text-right text-white">{fmt(valor)}</td>
                  <td className="px-6 py-3 text-right text-gray-400">
                    {totalFacturacion > 0 ? ((valor / totalFacturacion) * 100).toFixed(1) : '0.0'}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
