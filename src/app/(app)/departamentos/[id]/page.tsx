import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getDedicacionCalculada } from '@/lib/server/dedicacionCalculada'
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
  id_servicio: string | null
  minutos: number
  fecha: string
  descripcion: string | null
  empleado: { id: string; nombre: string } | null
  servicio: {
    id: string
    nombre: string | null
    notas: string | null
    cliente: { id: string; nombre: string } | null
  } | null
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
  id_departamento: string
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

interface FichajeEntry { fecha: string; descripcion: string | null; minutos: number }
interface ProjectEntry { label: string; logs: FichajeEntry[] }

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
    dedicaciones,
    { data: sueldosRaw },
    { data: ingresosRaw },
    { data: serviciosRaw },
    { data: gastosRaw },
    { data: empleadosRaw },
  ] = await Promise.all([
    supabase.from('departamentos').select('id, nombre, activo').eq('id', id).single(),
    // Sin filtro idDepartamento: necesitamos el total de minutos de cada empleado
    // para que el % sea correcto (minutos_en_este_depto / minutos_totales_empleado)
    getDedicacionCalculada(createAdminClient(), { anio }),
    supabase.from('sueldos').select('id_empleado, coste_total, mes').eq('anio', anio),
    supabase.from('ingresos').select('id_servicio, valor, mes').eq('id_departamento', id).eq('anio', anio),
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
    supabase.from('empleados').select('id, nombre').eq('activo', true),
  ])

  if (!dept) notFound()

  // Paginate time_logs for this department with service+client info
  const adminCl = createAdminClient()
  const timeLogsList: TimeLog[] = []
  {
    const PAGE = 1000; let from = 0
    while (true) {
      const { data } = await adminCl
        .from('time_logs')
        .select('id_empleado, id_servicio, minutos, fecha, descripcion, empleado:id_empleado(id, nombre), servicio:id_servicio(id, nombre, notas, cliente:id_cliente(id, nombre))')
        .eq('id_departamento', id)
        .gte('fecha', `${anio}-01-01`)
        .lte('fecha', `${anio}-12-31`)
        .order('fecha', { ascending: true })
        .range(from, from + PAGE - 1)
      if (!data?.length) break
      timeLogsList.push(...(data as unknown as TimeLog[]))
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  // Only dedicaciones for THIS department (correct % because denominator = all minutes)
  const dedicacionList = (dedicaciones ?? []).filter(d => d.id_departamento === id) as EmpleadoDedicacion[]
  const sueldosList = (sueldosRaw ?? []) as Sueldo[]
  const ingresosList = (ingresosRaw ?? []) as Ingreso[]
  const gastosList = (gastosRaw ?? []) as GastoFijo[]
  const serviciosList = (serviciosRaw ?? []) as unknown as Servicio[]
  const empleadosList = (empleadosRaw ?? []) as EmpleadoInfo[]

  const empNameMap = new Map<string, string>()
  for (const e of empleadosList) empNameMap.set(e.id, e.nombre)

  // sueldo map
  const sueldoMap = new Map<string, number>()
  for (const s of sueldosList) sueldoMap.set(`${s.id_empleado}_${s.mes}`, Number(s.coste_total ?? 0))

  // Fetch servicio_responsables
  const servicioIds = serviciosList.map(s => s.id)
  const { data: responsablesServicioRaw } = servicioIds.length > 0
    ? await supabase.from('servicio_responsables').select('id_servicio, id_empleado, mes, porcentaje').in('id_servicio', servicioIds).eq('anio', anio)
    : { data: [] }
  const responsablesServicio = (responsablesServicioRaw ?? []) as ServicioResponsable[]

  const ingresosMap = new Map<string, number>()
  for (const ing of ingresosList) {
    if (ing.id_servicio) {
      const k = `${ing.id_servicio}_${ing.mes}`
      ingresosMap.set(k, (ingresosMap.get(k) ?? 0) + Number(ing.valor))
    }
  }

  // respByServicio for projects table
  const respByServicio = new Map<string, string[]>()
  for (const r of responsablesServicio) {
    if (!respByServicio.has(r.id_servicio)) respByServicio.set(r.id_servicio, [])
    const nombre = empNameMap.get(r.id_empleado)
    if (nombre && !respByServicio.get(r.id_servicio)!.includes(nombre)) respByServicio.get(r.id_servicio)!.push(nombre)
  }

  // Build empMonthMap: empId → mes → servicioKey → { label, logs }
  const empMonthMap = new Map<string, Map<number, Map<string, ProjectEntry>>>()
  const empMonthMinutes = new Map<string, Map<number, number>>() // empId → mes → total minutes in this dept
  for (const tl of timeLogsList) {
    const empId = tl.id_empleado
    const mes = parseInt(tl.fecha.substring(5, 7))
    const svc = tl.servicio as { nombre: string | null; notas: string | null; cliente: { nombre: string } | null } | null
    const clienteNombre = svc?.cliente?.nombre ?? null
    const svcNombre = svc?.notas ?? svc?.nombre ?? null
    const label = clienteNombre && svcNombre
      ? `${clienteNombre} · ${svcNombre}`
      : clienteNombre ?? svcNombre ?? 'Sin proyecto'
    const svcKey = tl.id_servicio ?? '__none__'

    if (!empMonthMap.has(empId)) empMonthMap.set(empId, new Map())
    const monthMap = empMonthMap.get(empId)!
    if (!monthMap.has(mes)) monthMap.set(mes, new Map())
    const projMap = monthMap.get(mes)!
    if (!projMap.has(svcKey)) projMap.set(svcKey, { label, logs: [] })
    projMap.get(svcKey)!.logs.push({ fecha: tl.fecha, descripcion: tl.descripcion, minutos: tl.minutos })

    if (!empMonthMinutes.has(empId)) empMonthMinutes.set(empId, new Map())
    const mmap = empMonthMinutes.get(empId)!
    mmap.set(mes, (mmap.get(mes) ?? 0) + tl.minutos)
  }

  // Build personal detail per employee
  const dedicMap = new Map<string, number>() // empId_mes → porcentaje
  for (const d of dedicacionList) dedicMap.set(`${d.id_empleado}_${d.mes}`, d.porcentaje)

  // All employees who appear in either dedicacion or time_logs for this dept
  const allEmpIds = new Set<string>([
    ...dedicacionList.map(d => d.id_empleado),
    ...Array.from(empMonthMap.keys()),
  ])

  const personalDetalle = Array.from(allEmpIds).map(empId => {
    const nombre = empNameMap.get(empId) ?? empId
    // Months with any data
    const allMeses = new Set<number>([
      ...dedicacionList.filter(d => d.id_empleado === empId).map(d => d.mes),
      ...Array.from(empMonthMap.get(empId)?.keys() ?? []),
    ])
    const mesData = Array.from(allMeses).sort((a, b) => a - b).map(mes => {
      const pct = dedicMap.get(`${empId}_${mes}`) ?? 0
      const sueldo = sueldoMap.get(`${empId}_${mes}`) ?? 0
      const costeDept = sueldo * pct / 100
      const facturacion = responsablesServicio
        .filter(r => r.id_empleado === empId && r.mes === mes)
        .reduce((sum, r) => sum + (ingresosMap.get(`${r.id_servicio}_${r.mes}`) ?? 0) * r.porcentaje / 100, 0)
      const minDept = empMonthMinutes.get(empId)?.get(mes) ?? 0
      const projects = Array.from(empMonthMap.get(empId)?.get(mes)?.entries() ?? [])
        .map(([, p]) => p)
      return { mes, sueldo, pct, costeDept, facturacion, rentabilidad: facturacion - costeDept, minDept, projects }
    })

    const totalCosteDept = mesData.reduce((s, m) => s + m.costeDept, 0)
    const totalFacturacion = mesData.reduce((s, m) => s + m.facturacion, 0)
    const totalMinDept = mesData.reduce((s, m) => s + m.minDept, 0)

    return { empId, nombre, mesData, totalCosteDept, totalFacturacion, totalRentabilidad: totalFacturacion - totalCosteDept, totalMinDept }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre))

  // Totals
  const ingresosTotal = ingresosList.reduce((s, i) => s + Number(i.valor), 0)
  const gastosPropiosTotal = gastosList.reduce((s, g) => s + Number(g.valor), 0)
  const costePersonalTotal = personalDetalle.reduce((s, r) => s + r.totalCosteDept, 0)
  const costeTotalGeneral = costePersonalTotal + gastosPropiosTotal
  const resultado = ingresosTotal - costeTotalGeneral
  const margenPct = ingresosTotal > 0 ? (resultado / ingresosTotal) * 100 : 0

  // Monthly breakdown table
  const monthlyRows = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const ingresosMes = ingresosList.filter(x => x.mes === mes).reduce((s, x) => s + Number(x.valor), 0)
    const gastosMes = gastosList.filter(x => x.mes === mes).reduce((s, x) => s + Number(x.valor), 0)
    const costPersonalMes = dedicacionList
      .filter(d => d.mes === mes)
      .reduce((s, d) => s + (sueldoMap.get(`${d.id_empleado}_${mes}`) ?? 0) * d.porcentaje / 100, 0)
    return { mes, ingresosMes, gastosMes, costPersonalMes, resultadoMes: ingresosMes - gastosMes - costPersonalMes }
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link href="/departamentos" className="text-gray-500 hover:text-gray-300 text-sm transition-colors inline-flex items-center gap-1 mb-3">
          ← Departamentos
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">{dept.nombre}</h2>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${dept.activo ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'}`}>
            {dept.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <p className="text-gray-500 text-sm mt-1">Año {anio} · Vista de rentabilidad</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs font-medium">Ingresos</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{fmt(ingresosTotal)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs font-medium">Costes Total</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{fmt(costeTotalGeneral)}</p>
          <p className="text-gray-600 text-[10px] mt-0.5">Personal {fmt(costePersonalTotal)} + Propios {fmt(gastosPropiosTotal)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs font-medium">Resultado</p>
          <p className={`text-2xl font-bold mt-1 ${resultado >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(resultado)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs font-medium">Margen %</p>
          <p className={`text-2xl font-bold mt-1 ${margenPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {ingresosTotal > 0 ? fmtPct(margenPct) : '—'}
          </p>
        </div>
      </div>

      {/* Personal */}
      <div className="space-y-4">
        <div>
          <h3 className="text-white font-semibold text-lg">Personal</h3>
          <p className="text-gray-500 text-xs mt-0.5">Empleados con fichajes en este servicio — {anio}</p>
        </div>

        {personalDetalle.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl py-8 text-center">
            <p className="text-gray-500 text-sm">Sin empleados con fichajes en este servicio este año</p>
          </div>
        ) : (
          personalDetalle.map(emp => {
            const rentabPct = emp.totalFacturacion > 0 ? (emp.totalRentabilidad / emp.totalFacturacion) * 100 : 0
            return (
              <div key={emp.empId} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Employee header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="text-white font-semibold">{emp.nombre}</h4>
                    <span className="text-[11px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                      {fmtMin(emp.totalMinDept)} en este servicio
                    </span>
                    <span className={`text-[11px] border px-2 py-0.5 rounded-full ${emp.totalRentabilidad >= 0 ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                      {emp.totalRentabilidad >= 0 ? '+' : ''}{fmt(emp.totalRentabilidad)} rentabilidad
                      {emp.totalFacturacion > 0 && <span className="ml-1 opacity-70">({rentabPct.toFixed(0)}%)</span>}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Coste imputado al servicio</p>
                    <p className="text-white font-bold">{fmt(emp.totalCosteDept)}</p>
                  </div>
                </div>

                {/* Per month */}
                <div className="divide-y divide-gray-800/60">
                  {emp.mesData.map(m => (
                    <div key={m.mes} className="px-6 py-4">
                      {/* Month summary row */}
                      <div className="flex flex-wrap items-center gap-4 mb-3">
                        <span className="text-white font-semibold w-28">{MESES[m.mes - 1]}</span>
                        <div className="flex flex-wrap gap-6 text-sm">
                          <div>
                            <span className="text-gray-500 text-xs">Horas</span>
                            <p className="text-blue-400 font-medium">{fmtMin(m.minDept)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">% tiempo</span>
                            <p className="text-blue-300 font-medium">{m.pct > 0 ? fmtPct(m.pct) : '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Sueldo</span>
                            <p className="text-gray-300">{m.sueldo > 0 ? fmt(m.sueldo) : '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Coste imputado</span>
                            <p className="text-orange-400 font-medium">{m.costeDept > 0 ? fmt(m.costeDept) : '—'}</p>
                          </div>
                          {m.facturacion > 0 && (
                            <>
                              <div>
                                <span className="text-gray-500 text-xs">Facturación</span>
                                <p className="text-white font-medium">{fmt(m.facturacion)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 text-xs">Rentabilidad</span>
                                <p className={`font-medium ${m.rentabilidad >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(m.rentabilidad)}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Project breakdown */}
                      {m.projects.length > 0 && (
                        <div className="ml-32 space-y-2">
                          {m.projects.map((proj, pi) => (
                            <div key={pi} className="bg-gray-800/40 rounded-lg overflow-hidden">
                              {/* Project header */}
                              <div className="px-4 py-2 border-b border-gray-700/50 flex items-center justify-between">
                                <span className="text-gray-300 text-xs font-medium">{proj.label}</span>
                                <span className="text-blue-400 text-xs">{fmtMin(proj.logs.reduce((s, l) => s + l.minutos, 0))}</span>
                              </div>
                              {/* Individual fichajes */}
                              <table className="w-full text-xs">
                                <tbody>
                                  {proj.logs.map((log, li) => (
                                    <tr key={li} className="border-b border-gray-700/30 last:border-0 hover:bg-gray-700/20">
                                      <td className="px-4 py-1.5 text-gray-500 whitespace-nowrap w-24">
                                        {new Date(log.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                      </td>
                                      <td className="px-4 py-1.5 text-gray-400">{log.descripcion ?? '—'}</td>
                                      <td className="px-4 py-1.5 text-right text-blue-400 whitespace-nowrap w-20">{fmtMin(log.minutos)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Employee footer */}
                <div className="px-6 py-3 bg-gray-800/30 border-t border-gray-700 flex justify-between items-center text-sm">
                  <span className="text-gray-400 text-xs">Total anual</span>
                  <div className="flex gap-6">
                    <span className="text-orange-400 font-bold">{fmt(emp.totalCosteDept)} coste</span>
                    {emp.totalFacturacion > 0 && <span className="text-white font-bold">{fmt(emp.totalFacturacion)} facturado</span>}
                    <span className={`font-bold ${emp.totalRentabilidad >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(emp.totalRentabilidad)} resultado</span>
                  </div>
                </div>
              </div>
            )
          })
        )}

        {personalDetalle.length > 0 && (
          <div className="flex justify-end">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-6 py-3 text-sm">
              <span className="text-gray-400">Total coste personal imputado: </span>
              <span className="text-white font-bold ml-2">{fmt(costePersonalTotal)}</span>
            </div>
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
                    <td className="px-6 py-3 text-white font-medium">{s.cliente?.nombre ?? <span className="text-gray-500">—</span>}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{(respByServicio.get(s.id) ?? []).join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate" title={s.notas ?? s.nombre ?? ''}>{s.notas ?? s.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {s.tipo === 'recurrente' ? <span className="bg-blue-900/40 text-blue-400 border border-blue-800 px-2 py-0.5 rounded text-xs font-medium">REC</span>
                        : s.tipo === 'unico' ? <span className="bg-purple-900/40 text-purple-400 border border-purple-800 px-2 py-0.5 rounded text-xs font-medium">ONE</span>
                        : <span className="text-gray-600 text-xs">{s.tipo ?? '—'}</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.activo ? 'bg-green-900/40 text-green-400 border border-green-800' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
                        {s.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{s.fecha_inicio ? new Date(s.fecha_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{s.fecha_fin ? new Date(s.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Evolución mensual */}
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
                  <td className="px-4 py-2.5 text-right"><span className={r.ingresosMes > 0 ? 'text-green-400 font-medium' : 'text-gray-600'}>{r.ingresosMes > 0 ? fmt(r.ingresosMes) : '—'}</span></td>
                  <td className="px-4 py-2.5 text-right"><span className={r.costPersonalMes > 0 ? 'text-orange-400' : 'text-gray-600'}>{r.costPersonalMes > 0 ? fmt(r.costPersonalMes) : '—'}</span></td>
                  <td className="px-4 py-2.5 text-right"><span className={r.gastosMes > 0 ? 'text-orange-400' : 'text-gray-600'}>{r.gastosMes > 0 ? fmt(r.gastosMes) : '—'}</span></td>
                  <td className="px-6 py-2.5 text-right">
                    <span className={`font-semibold ${r.ingresosMes === 0 && r.gastosMes === 0 && r.costPersonalMes === 0 ? 'text-gray-600' : r.resultadoMes >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
                <td className={`px-6 py-3 text-right font-bold ${resultado >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(resultado)}</td>
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
