import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import HistoricoClient from './HistoricoClient'

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  const { cliente: clienteId } = await searchParams
  const supabase = await createClient()

  // All clients (active + inactive) for the selector
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, activo')
    .order('nombre')

  let datosPorAno: {
    ano: number
    facturacion: number
    coste_directo: number
    coste_personal: number
    coste: number
    margen: number
    margen_pct: number
  }[] = []

  let clienteSeleccionado = null

  if (clienteId && clientes) {
    clienteSeleccionado = clientes.find(c => c.id === clienteId) ?? null

    if (clienteSeleccionado) {
      const admin = createAdminClient()

      const [
        { data: ingresos },
        { data: gastos },
        { data: sueldos },
      ] = await Promise.all([
        supabase.from('ingresos').select('valor, anio').eq('id_cliente', clienteId),
        supabase.from('gastos_fijos').select('valor, anio').eq('id_cliente', clienteId),
        admin.from('sueldos').select('id_empleado, coste_total, mes, anio'),
      ])

      // Paginate time_logs for THIS client (all years)
      const clientTimeLogs: { id_empleado: string; minutos: number; fecha: string }[] = []
      {
        const PAGE = 1000; let from = 0
        while (true) {
          const { data } = await admin.from('time_logs')
            .select('id_empleado, minutos, fecha')
            .eq('id_cliente', clienteId)
            .range(from, from + PAGE - 1)
          if (!data?.length) break
          clientTimeLogs.push(...data)
          if (data.length < PAGE) break
          from += PAGE
        }
      }

      // Paginate ALL time_logs (all employees, all years) — denominator for cost allocation
      const allTimeLogs: { id_empleado: string; minutos: number; fecha: string }[] = []
      {
        const PAGE = 1000; let from = 0
        while (true) {
          const { data } = await admin.from('time_logs')
            .select('id_empleado, minutos, fecha')
            .range(from, from + PAGE - 1)
          if (!data?.length) break
          allTimeLogs.push(...data)
          if (data.length < PAGE) break
          from += PAGE
        }
      }

      // sueldoMap: `${id_empleado}_${anio}_${mes}` -> coste_total
      const sueldoMap = new Map<string, number>()
      for (const s of sueldos ?? []) {
        sueldoMap.set(`${s.id_empleado}_${s.anio}_${s.mes}`, Number(s.coste_total))
      }

      // totalMinMap: `${id_empleado}_${anio}_${mes}` -> total minutos (all clients)
      const totalMinMap = new Map<string, number>()
      for (const t of allTimeLogs) {
        const anioT = parseInt(t.fecha.slice(0, 4))
        const mesT = parseInt(t.fecha.slice(5, 7))
        const key = `${t.id_empleado}_${anioT}_${mesT}`
        totalMinMap.set(key, (totalMinMap.get(key) ?? 0) + t.minutos)
      }

      // Compute coste_personal per year: (minutos_cliente / minutos_totales) × sueldo
      const costePersonalByYear = new Map<number, number>()
      for (const t of clientTimeLogs) {
        const anioT = parseInt(t.fecha.slice(0, 4))
        const mesT = parseInt(t.fecha.slice(5, 7))
        const totalMin = totalMinMap.get(`${t.id_empleado}_${anioT}_${mesT}`) ?? 0
        if (totalMin === 0) continue
        const sueldo = sueldoMap.get(`${t.id_empleado}_${anioT}_${mesT}`) ?? 0
        const coste = sueldo * (t.minutos / totalMin)
        costePersonalByYear.set(anioT, (costePersonalByYear.get(anioT) ?? 0) + coste)
      }

      // Group ingresos and gastos by year
      const byYear: Record<number, { facturacion: number; coste_directo: number }> = {}
      for (const i of ingresos ?? []) {
        if (!byYear[i.anio]) byYear[i.anio] = { facturacion: 0, coste_directo: 0 }
        byYear[i.anio].facturacion += Number(i.valor ?? 0)
      }
      for (const g of gastos ?? []) {
        if (!byYear[g.anio]) byYear[g.anio] = { facturacion: 0, coste_directo: 0 }
        byYear[g.anio].coste_directo += Number(g.valor ?? 0)
      }

      const allYears = new Set([
        ...Object.keys(byYear).map(Number),
        ...costePersonalByYear.keys(),
      ])

      datosPorAno = Array.from(allYears)
        .map(ano => {
          const data = byYear[ano] ?? { facturacion: 0, coste_directo: 0 }
          const coste_personal = costePersonalByYear.get(ano) ?? 0
          const coste = data.coste_directo + coste_personal
          const margen = data.facturacion - coste
          const margen_pct = data.facturacion > 0 ? (margen / data.facturacion) * 100 : 0
          return {
            ano,
            facturacion: data.facturacion,
            coste_directo: data.coste_directo,
            coste_personal,
            coste,
            margen,
            margen_pct,
          }
        })
        .sort((a, b) => a.ano - b.ano)
    }
  }

  return (
    <HistoricoClient
      clientes={clientes ?? []}
      datosPorAno={datosPorAno}
      clienteSeleccionado={clienteSeleccionado}
    />
  )
}
