import { createClient } from '@/lib/server/supabase'
import { getDedicacionCalculada } from '@/lib/server/dedicacionCalculada'
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
      // Fetch all data needed (no year filter — historical)
      const [
        { data: ingresos },
        { data: gastos },
        { data: servicios },
        { data: todosServicios },
        { data: allResponsables },
        { data: sueldos },
        dedicaciones,
      ] = await Promise.all([
        supabase.from('ingresos').select('valor, anio').eq('id_cliente', clienteId),
        supabase.from('gastos_fijos').select('valor, anio').eq('id_cliente', clienteId),
        supabase.from('servicios').select('id, id_departamento').eq('id_cliente', clienteId),
        supabase.from('servicios').select('id, id_departamento'),
        supabase.from('servicio_responsables').select('id_servicio, id_empleado, mes, anio'),
        supabase.from('sueldos').select('id_empleado, coste_total, mes, anio'),
        getDedicacionCalculada(supabase, {}),
      ])

      const servicioIds = (servicios ?? []).map(s => s.id)
      const clienteServicioIds = new Set(servicioIds)

      // Global servicioMap: id -> { id_departamento }
      const globalServicioMap = new Map<string, { id_departamento: string | null }>()
      for (const s of todosServicios ?? []) {
        globalServicioMap.set(s.id, { id_departamento: s.id_departamento ?? null })
      }

      // sueldoMap: `${id_empleado}_${anio}_${mes}` -> coste_total
      const sueldoMap = new Map<string, number>()
      for (const s of sueldos ?? []) {
        sueldoMap.set(`${s.id_empleado}_${s.anio}_${s.mes}`, Number(s.coste_total))
      }

      // dedicacionMap: `${id_empleado}_${id_departamento}_${anio}_${mes}` -> porcentaje
      const dedicacionMap = new Map<string, number>()
      for (const d of dedicaciones ?? []) {
        dedicacionMap.set(`${d.id_empleado}_${d.id_departamento}_${d.anio}_${d.mes}`, Number(d.porcentaje))
      }

      // numServiciosMap: `${id_empleado}_${id_departamento}_${anio}_${mes}` -> count (all clients)
      const numServiciosMap = new Map<string, number>()
      for (const r of allResponsables ?? []) {
        const servicio = globalServicioMap.get(r.id_servicio)
        const deptId = servicio?.id_departamento
        if (!deptId) continue
        const key = `${r.id_empleado}_${deptId}_${r.anio}_${r.mes}`
        numServiciosMap.set(key, (numServiciosMap.get(key) ?? 0) + 1)
      }

      // Compute coste_personal per year for this client
      const costePersonalByYear = new Map<number, number>()
      for (const r of allResponsables ?? []) {
        if (!clienteServicioIds.has(r.id_servicio)) continue
        const servicio = globalServicioMap.get(r.id_servicio)
        const deptId = servicio?.id_departamento
        if (!deptId) continue
        const sueldo = sueldoMap.get(`${r.id_empleado}_${r.anio}_${r.mes}`) ?? 0
        const dedicacion = dedicacionMap.get(`${r.id_empleado}_${deptId}_${r.anio}_${r.mes}`) ?? 0
        const numServicios = numServiciosMap.get(`${r.id_empleado}_${deptId}_${r.anio}_${r.mes}`) ?? 1
        const coste = sueldo * (dedicacion / 100) / numServicios
        costePersonalByYear.set(r.anio, (costePersonalByYear.get(r.anio) ?? 0) + coste)
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

      // Collect all years (ingresos + coste_personal years)
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
