import { createClient } from '@/lib/server/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

const fmtPct = (v: number) => v.toFixed(1) + '%'

function fmtMin(m: number) {
  const h = Math.floor(m / 60); const min = m % 60
  if (h > 0 && min > 0) return `${h}h ${min}m`
  if (h > 0) return `${h}h`
  return `${min}m`
}

interface TimeLog {
  id_empleado: string
  minutos: number
  fecha: string
  descripcion: string | null
  empleado: { id: string; nombre: string } | null
}

interface Servicio {
  id: string
  nombre: string | null
  notas: string | null
  tipo: string | null
  activo: boolean | null
  fecha_inicio: string | null
  fecha_fin: string | null
  cliente: { id: string; nombre: string } | null
}

interface EmpleadoDedicacion {
  id_empleado: string
  porcentaje: number
  mes: number
}

interface Sueldo {
  id_empleado: string
  coste_total: number | null
  mes: number
}

interface Ingreso {
  id_servicio: string | null
  valor: number
  mes: number
}

interface GastoFijo {
  concepto: string
  valor: number
  mes: number
}

interface EmpleadoInfo {
  id: string
  nombre: string
}

interface ServicioResponsable {
  id_servicio: string
  id_empleado: string
  mes: number
  porcentaje: number
}

export default async function DepartamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const anio = new Date().getFullYear()

  const [
    { data: dept },
    { data: dedicaciones },
    { data: sueldosRaw },
    { data: ingresosRaw },
    { data: serviciosRaw },
    { data: gastosRaw },
    { data: empleadosRaw },
    { data: timeLogsRaw },
  ] = await Promise.all([
    supabase.from('departamentos').select('id, nombre, activo').eq('id', id).single(),
    supabase
      .from('empleado_dedicacion')
      .select('id_empleado, porcentaje, mes, anio')
      .eq('id_departamento', id)
      .eq('anio', anio),
    supabase
      .from('sueldos')
      .select('id_empleado, coste_total, mes')
      .eq('anio', anio),
    supabase
      .from('ingresos')
      .select('id_servicio, valor, mes')
      .eq('id_departamento', id)
      .eq('anio', anio),
    supabase
      .from('servicios')
      .select('id, nombre, notas, tipo, activo, fecha_inicio, fecha_fin, cliente:id_cliente(id,nombre)')
      .eq('id_departamento', id)
      .order('activo', { ascending: false })
      .order('nombre'),
    supabase
      .from('gastos_fijos')
      .select('concepto, valor, mes')
      .eq('id_departamento', id)
      .eq('tipo', 'departamento')
      .eq('anio', anio)
      .order('mes'),
    supabase
      .from('empleados')
      .select('id, nombre')
      .eq('activo', true),
    supabase
      .from('time_logs')
      .select('id_empleado, minutos, fecha, descripcion, empleado:id_empleado(id, nombre)')
      .eq('id_departamento', id)
      .gte('fecha', `${anio}-01-01`)
      .lte('fecha', `${anio}-12-31`),
  ])

  if (!dept) notFound()

  const timeLogsList = (timeLogsRaw ?? []) as unknown as TimeLog[]

  const dedicacionList = (dedicaciones ?? []) as EmpleadoDedicacion[]
  const sueldosList = (sueldosRaw ?? []) as Sueldo[]
  const ingresosList = (ingresosRaw ?? []) as Ingreso[]
  const gastosList = (gastosRaw ?? []) as GastoFijo[]
  const serviciosList = (serviciosRaw ?? []) as unknown as Servicio[]
  const empleadosList = (empleadosRaw ?? []) as EmpleadoInfo[]

  // Build employee name map
  const empNameMap = new Map<string, string>()
  for (const e of empleadosList) empNameMap.set(e.id, e.nombre)

  // Aggregate time_logs by employee
  const timeByEmp = new Map<string, { nombre: string; minutos: number }>()
  for (const tl of timeLogsList) {
    const empId = tl.id_empleado
    const empNombre = (tl.empleado as { nombre: string } | null)?.nombre ?? empNameMap.get(empId) ?? empId
    const existing = timeByEmp.get(empId)
    if (existing) {
      existing.minutos += Number(tl.minutos)
    } else {
      timeByEmp.set(empId, { nombre: empNombre, minutos: Number(tl.minutos) })
    }
  }
  const totalMinutosDept = Array.from(timeByEmp.values()).reduce((s, e) => s + e.minutos, 0)
  const timeByEmpRows = Array.from(timeByEmp.entries())
    .map(([empId, { nombre, minutos }]) => ({ empId, nombre, minutos }))
    .sort((a, b) => b.minutos - a.minutos)

  // Build sueldo map: `${id_empleado}_${mes}` → coste_total
  const sueldoMap = new Map<string, number>()
  for (const s of sueldosList) {
    sueldoMap.set(`${s.id_empleado}_${s.mes}`, Number(s.coste_total ?? 0))
  }

  // Fetch servicio_responsables for services in this dept
  const servicioIds = (serviciosList).map(s => s.id)
  const { data: responsablesServicioRaw } = servicioIds.length > 0
    ? await supabase
        .from('servicio_responsables')
        .select('id_servicio, id_empleado, mes, porcentaje')
        .in('id_servicio', servicioIds)
        .eq('anio', anio)
    : { data: [] }

  const responsablesServicio = (responsablesServicioRaw ?? []) as ServicioResponsable[]

  // Build map: servicioId → unique employee names (for services table)
  const respByServicio = new Map<string, string[]>()
  for (const r of responsablesServicio) {
    if (!respByServicio.has(r.id_servicio)) respByServicio.set(r.id_servicio, [])
    const nombre = empNameMap.get(r.id_empleado)
    if (nombre && !respByServicio.get(r.id_servicio)!.includes(nombre)) {
      respByServicio.get(r.id_servicio)!.push(nombre)
    }
  }

  // Build ingresos map: id_servicio_mes → valor
  const ingresosMap = new Map<string, number>()
  for (const ing of ingresosList) {
    if (ing.id_servicio) ingresosMap.set(`${ing.id_servicio}_${ing.mes}`, Number(ing.valor))
  }



  // Set of active service IDs in this dept
  const activeServicioIds = new Set(serviciosList.filter(s => s.activo === true).map(s => s.id))

  // Aggregate dedicación by employee
  const empDedicMap = new Map<string, { pcts: number[]; meses: number[] }>()
  for (const d of dedicacionList) {
    if (!empDedicMap.has(d.id_empleado)) {
      empDedicMap.set(d.id_empleado, { pcts: [], meses: [] })
    }
    const entry = empDedicMap.get(d.id_empleado)!
    entry.pcts.push(d.porcentaje)
    entry.meses.push(d.mes)
  }

  // Per-employee monthly detail
  const personalDetalle = Array.from(empDedicMap.entries()).map(([empId, { pcts, meses }]) => {
    const avgPct = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0

    const mesData = meses.map((mes, i) => {
      const pct = pcts[i]
      const sueldo = sueldoMap.get(`${empId}_${mes}`) ?? 0
      const costeDept = sueldo * pct / 100
      const facturacion = responsablesServicio
        .filter(r => r.id_empleado === empId && r.mes === mes)
        .reduce((sum, r) => sum + (ingresosMap.get(`${r.id_servicio}_${r.mes}`) ?? 0) * r.porcentaje / 100, 0)
      return { mes, sueldo, pct, costeDept, facturacion, rentabilidad: facturacion - costeDept }
    }).sort((a, b) => a.mes - b.mes)

    const totalCosteDept = mesData.reduce((s, m) => s + m.costeDept, 0)
    const totalFacturacion = mesData.reduce((s, m) => s + m.facturacion, 0)
    const totalRentabilidad = totalFacturacion - totalCosteDept

    return {
      empId,
      nombre: empNameMap.get(empId) ?? empId,
      avgPct,
      mesData,
      totalCosteDept,
      totalFacturacion,
      totalRentabilidad,
    }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre))

  // Summary for KPI totals (kept for totals calculation)
  const personalRows = personalDetalle.map(r => ({ sueldoImputado: r.totalCosteDept }))

  // Totals
  const ingresosTotal = ingresosList.reduce((s, i) => s + Number(i.valor), 0)
  const gastosPropiosTotal = gastosList.reduce((s, g) => s + Number(g.valor), 0)
  const costePersonalTotal = personalRows.reduce((s, r) => s + r.sueldoImputado, 0)
  const costeTotalGeneral = costePersonalTotal + gastosPropiosTotal
  const resultado = ingresosTotal - costeTotalGeneral
  const margenPct = ingresosTotal > 0 ? (resultado / ingresosTotal) * 100 : 0

  // Monthly breakdown
  const monthlyRows = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const ingresosMes = ingresosList.filter(x => x.mes === mes).reduce((s, x) => s + Number(x.valor), 0)
    const gastosMes = gastosList.filter(x => x.mes === mes).reduce((s, x) => s + Number(x.valor), 0)
    // coste personal for this month: sum over all employees with dedicacion in this month
    const costPersonalMes = dedicacionList
      .filter(d => d.mes === mes)
      .reduce((s, d) => {
        const sueldo = sueldoMap.get(`${d.id_empleado}_${mes}`) ?? 0
        return s + sueldo * d.porcentaje / 100
      }, 0)
    const resultadoMes = ingresosMes - gastosMes - costPersonalMes
    return { mes, ingresosMes, gastosMes, costPersonalMes, resultadoMes }
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/departamentos"
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors inline-flex items-center gap-1 mb-3"
          >
            ← Departamentos
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">{dept.nombre}</h2>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                dept.activo
                  ? 'bg-green-900/50 text-green-400 border border-green-800'
                  : 'bg-red-900/50 text-red-400 border border-red-800'
              }`}
            >
              {dept.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">Año {anio} · Vista de rentabilidad</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs font-medium">Ingresos</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{fmt(ingresosTotal)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs font-medium">Costes Total</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{fmt(costeTotalGeneral)}</p>
          <p className="text-gray-600 text-[10px] mt-0.5">
            Personal {fmt(costePersonalTotal)} + Propios {fmt(gastosPropiosTotal)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs font-medium">Resultado</p>
          <p className={`text-2xl font-bold mt-1 ${resultado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmt(resultado)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs font-medium">Margen %</p>
          <p className={`text-2xl font-bold mt-1 ${margenPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {ingresosTotal > 0 ? fmtPct(margenPct) : '—'}
          </p>
        </div>
      </div>

      {/* Personal section — per-employee monthly breakdown */}
      <div className="space-y-4">
        <div>
          <h3 className="text-white font-semibold text-lg">Personal</h3>
          <p className="text-gray-500 text-xs mt-0.5">Empleados con dedicación en {anio} · Desglose mensual</p>
        </div>

        {personalDetalle.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl py-8 text-center">
            <p className="text-gray-500 text-sm">Sin empleados con dedicación asignada este año</p>
          </div>
        ) : (
          personalDetalle.map(emp => {
            const rentabPct = emp.totalFacturacion > 0 ? (emp.totalRentabilidad / emp.totalFacturacion) * 100 : 0
            const mesByMes = new Map(emp.mesData.map(m => [m.mes, m]))

            return (
              <div key={emp.empId} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="text-white font-semibold">{emp.nombre}</h4>
                    <span className="text-[11px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                      {emp.avgPct.toFixed(0)}% dedicación media
                    </span>
                    <span className={`text-[11px] border px-2 py-0.5 rounded-full ${
                      emp.totalRentabilidad >= 0
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      {emp.totalRentabilidad >= 0 ? '+' : ''}{fmt(emp.totalRentabilidad)} rentabilidad
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Coste total al depto</p>
                    <p className="text-white font-bold">{fmt(emp.totalCosteDept)}</p>
                  </div>
                </div>

                {/* Monthly table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                        <th className="text-left px-6 py-3">Mes</th>
                        <th className="text-right px-4 py-3">Sueldo</th>
                        <th className="text-right px-4 py-3">Dedicación</th>
                        <th className="text-right px-4 py-3">Coste al depto</th>
                        <th className="text-right px-4 py-3">Facturación</th>
                        <th className="text-right px-6 py-3">Rentabilidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 12 }, (_, i) => {
                        const mes = i + 1
                        const d = mesByMes.get(mes)
                        if (!d) {
                          return (
                            <tr key={mes} className="border-b border-gray-800/40">
                              <td className="px-6 py-2.5 text-gray-700 font-medium">{MESES[i]}</td>
                              <td className="px-4 py-2.5 text-right text-gray-700">—</td>
                              <td className="px-4 py-2.5 text-right text-gray-700">—</td>
                              <td className="px-4 py-2.5 text-right text-gray-700">—</td>
                              <td className="px-4 py-2.5 text-right text-gray-700">—</td>
                              <td className="px-6 py-2.5 text-right text-gray-700">—</td>
                            </tr>
                          )
                        }
                        const rentMesPct = d.facturacion > 0 ? (d.rentabilidad / d.facturacion) * 100 : null
                        return (
                          <tr key={mes} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="px-6 py-2.5 text-white font-medium">{MESES[i]}</td>
                            <td className="px-4 py-2.5 text-right text-gray-300">{fmt(d.sueldo)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="text-blue-400 font-medium">{d.pct}%</span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-orange-400">{fmt(d.costeDept)}</td>
                            <td className="px-4 py-2.5 text-right">
                              {d.facturacion > 0
                                ? <span className="text-white">{fmt(d.facturacion)}</span>
                                : <span className="text-gray-600">—</span>}
                            </td>
                            <td className="px-6 py-2.5 text-right">
                              <span className={`font-medium ${d.rentabilidad >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {fmt(d.rentabilidad)}
                              </span>
                              {rentMesPct !== null && (
                                <span className={`block text-[11px] ${d.rentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {rentMesPct.toFixed(1)}%
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-700 bg-gray-800/30">
                        <td className="px-6 py-3 text-gray-400 font-semibold text-xs uppercase tracking-wide">Total anual</td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right text-orange-400 font-bold">{fmt(emp.totalCosteDept)}</td>
                        <td className="px-4 py-3 text-right text-white font-bold">{fmt(emp.totalFacturacion)}</td>
                        <td className="px-6 py-3 text-right">
                          <span className={`font-bold ${emp.totalRentabilidad >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {fmt(emp.totalRentabilidad)}
                          </span>
                          {emp.totalFacturacion > 0 && (
                            <span className={`block text-[11px] ${rentabPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {rentabPct.toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })
        )}

        {/* Total personal imputado */}
        {personalDetalle.length > 0 && (
          <div className="flex justify-end">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-6 py-3 text-sm">
              <span className="text-gray-400">Total coste personal imputado: </span>
              <span className="text-white font-bold ml-2">{fmt(costePersonalTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Horas fichadas */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Horas fichadas — {anio}</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            Total: <span className="text-blue-400 font-medium">{fmtMin(totalMinutosDept)}</span>
          </p>
        </div>
        {timeByEmpRows.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">Sin registros de tiempo en este periodo</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                  <th className="text-left px-6 py-3">Empleado</th>
                  <th className="text-right px-6 py-3">Horas</th>
                  <th className="text-right px-6 py-3">% del total</th>
                </tr>
              </thead>
              <tbody>
                {timeByEmpRows.map(row => (
                  <tr key={row.empId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-3 text-white font-medium">{row.nombre}</td>
                    <td className="px-6 py-3 text-right text-blue-400 font-medium">{fmtMin(row.minutos)}</td>
                    <td className="px-6 py-3 text-right text-gray-400">
                      {totalMinutosDept > 0 ? fmtPct((row.minutos / totalMinutosDept) * 100) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-700 bg-gray-800/30">
                  <td className="px-6 py-3 text-gray-400 font-semibold text-xs uppercase tracking-wide">Total</td>
                  <td className="px-6 py-3 text-right text-white font-bold">{fmtMin(totalMinutosDept)}</td>
                  <td className="px-6 py-3 text-right text-gray-400">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Proyectos / Servicios */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Proyectos y servicios</h3>
          <p className="text-gray-500 text-xs mt-0.5">{serviciosList.length} servicio{serviciosList.length !== 1 ? 's' : ''} vinculado{serviciosList.length !== 1 ? 's' : ''}</p>
        </div>
        {serviciosList.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">Sin servicios asignados a este departamento</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                  <th className="text-left px-6 py-3">Cliente</th>
                  <th className="text-left px-4 py-3">Responsables</th>
                  <th className="text-left px-4 py-3">Asunto</th>
                  <th className="text-center px-4 py-3">Tipo</th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="text-left px-4 py-3">Inicio</th>
                  <th className="text-left px-4 py-3">Fin</th>
                </tr>
              </thead>
              <tbody>
                {serviciosList.map(s => (
                  <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-3 text-white font-medium">
                      {s.cliente?.nombre ?? <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {(respByServicio.get(s.id) ?? []).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate" title={s.notas ?? s.nombre ?? ''}>
                      {s.notas ?? s.nombre ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.tipo === 'recurrente' ? (
                        <span className="bg-blue-900/40 text-blue-400 border border-blue-800 px-2 py-0.5 rounded text-xs font-medium">REC</span>
                      ) : s.tipo === 'unico' ? (
                        <span className="bg-purple-900/40 text-purple-400 border border-purple-800 px-2 py-0.5 rounded text-xs font-medium">ONE</span>
                      ) : (
                        <span className="text-gray-600 text-xs">{s.tipo ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.activo
                          ? 'bg-green-900/40 text-green-400 border border-green-800'
                          : 'bg-gray-800 text-gray-500 border border-gray-700'
                      }`}>
                        {s.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {s.fecha_inicio ? new Date(s.fecha_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {s.fecha_fin ? new Date(s.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ingresos mensuales */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Evolución mensual — {anio}</h3>
          <p className="text-gray-500 text-xs mt-0.5">Ingresos, costes y resultado por mes</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-6 py-3">Mes</th>
                <th className="text-right px-4 py-3">Ingresos</th>
                <th className="text-right px-4 py-3">Coste Personal</th>
                <th className="text-right px-4 py-3">Gastos Propios</th>
                <th className="text-right px-6 py-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.map(r => (
                <tr key={r.mes} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-6 py-2.5 text-gray-300 font-medium">{MESES[r.mes - 1]}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={r.ingresosMes > 0 ? 'text-green-400 font-medium' : 'text-gray-600'}>
                      {r.ingresosMes > 0 ? fmt(r.ingresosMes) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={r.costPersonalMes > 0 ? 'text-orange-400' : 'text-gray-600'}>
                      {r.costPersonalMes > 0 ? fmt(r.costPersonalMes) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={r.gastosMes > 0 ? 'text-orange-400' : 'text-gray-600'}>
                      {r.gastosMes > 0 ? fmt(r.gastosMes) : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-2.5 text-right">
                    <span className={`font-semibold ${
                      r.ingresosMes === 0 && r.gastosMes === 0 && r.costPersonalMes === 0
                        ? 'text-gray-600'
                        : r.resultadoMes >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}>
                      {r.ingresosMes === 0 && r.gastosMes === 0 && r.costPersonalMes === 0 ? '—' : fmt(r.resultadoMes)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-700 bg-gray-800/50">
                <td className="px-6 py-3 text-white font-bold">Total {anio}</td>
                <td className="px-4 py-3 text-right text-green-400 font-bold">{fmt(ingresosTotal)}</td>
                <td className="px-4 py-3 text-right text-orange-400 font-bold">{fmt(costePersonalTotal)}</td>
                <td className="px-4 py-3 text-right text-orange-400 font-bold">{fmt(gastosPropiosTotal)}</td>
                <td className={`px-6 py-3 text-right font-bold ${resultado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmt(resultado)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Gastos propios */}
      {gastosList.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Gastos propios del departamento</h3>
            <p className="text-gray-500 text-xs mt-0.5">Gastos asignados directamente a este departamento en {anio}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                  <th className="text-left px-6 py-3">Concepto</th>
                  <th className="text-center px-4 py-3">Mes</th>
                  <th className="text-right px-6 py-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {gastosList.map((g, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-2.5 text-white">{g.concepto}</td>
                    <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{MESES_CORTO[g.mes - 1]}</td>
                    <td className="px-6 py-2.5 text-right text-orange-400 font-medium">{fmt(Number(g.valor))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-700 bg-gray-800/50">
                  <td colSpan={2} className="px-6 py-3 text-gray-400 font-medium">Total gastos propios</td>
                  <td className="px-6 py-3 text-right text-white font-bold">{fmt(gastosPropiosTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
