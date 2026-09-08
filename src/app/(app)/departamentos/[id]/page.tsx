import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getDedicacionCalculada } from '@/lib/server/dedicacionCalculada'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import FiltroPeriodo from './FiltroPeriodo'

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
  id_cliente: string | null
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
  cliente: { id: string; nombre: string } | null
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
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string>>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const anio = Number(sp.anio) || new Date().getFullYear()
  const mesDesde = Math.min(12, Math.max(1, Number(sp.mesDesde) || 1))
  const mesHasta = Math.min(12, Math.max(mesDesde, Number(sp.mesHasta) || 12))
  const fechaDesde = `${anio}-${String(mesDesde).padStart(2, '0')}-01`
  const ultimoDia = new Date(anio, mesHasta, 0).getDate()
  const fechaHasta = `${anio}-${String(mesHasta).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

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
    getDedicacionCalculada(createAdminClient(), { anio }),
    supabase.from('sueldos').select('id_empleado, coste_total, mes').eq('anio', anio).gte('mes', mesDesde).lte('mes', mesHasta),
    supabase.from('ingresos').select('id_servicio, valor, mes').eq('id_departamento', id).eq('anio', anio).gte('mes', mesDesde).lte('mes', mesHasta),
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
      .gte('mes', mesDesde)
      .lte('mes', mesHasta)
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
        .select('id_empleado, id_servicio, id_cliente, minutos, fecha, descripcion, empleado:id_empleado(id, nombre), servicio:id_servicio(id, nombre, notas, cliente:id_cliente(id, nombre)), cliente:id_cliente(id, nombre)')
        .eq('id_departamento', id)
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta)
        .order('fecha', { ascending: true })
        .range(from, from + PAGE - 1)
      if (!data?.length) break
      timeLogsList.push(...(data as unknown as TimeLog[]))
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  const dedicacionList = (dedicaciones ?? []).filter(
    d => d.id_departamento === id && d.mes >= mesDesde && d.mes <= mesHasta
  ) as EmpleadoDedicacion[]
  const sueldosList = (sueldosRaw ?? []) as Sueldo[]
  const ingresosList = (ingresosRaw ?? []) as Ingreso[]
  const gastosList = (gastosRaw ?? []) as GastoFijo[]
  const serviciosList = (serviciosRaw ?? []) as unknown as Servicio[]
  const empleadosList = (empleadosRaw ?? []) as EmpleadoInfo[]

  const empNameMap = new Map<string, string>()
  for (const e of empleadosList) empNameMap.set(e.id, e.nombre)

  const sueldoMap = new Map<string, number>()
  for (const s of sueldosList) sueldoMap.set(`${s.id_empleado}_${s.mes}`, Number(s.coste_total ?? 0))

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

  // empMonthMinutes: empId → mes → total minutes in this dept
  const empMonthMinutes = new Map<string, Map<number, number>>()
  for (const tl of timeLogsList) {
    const mes = parseInt(tl.fecha.substring(5, 7))
    if (!empMonthMinutes.has(tl.id_empleado)) empMonthMinutes.set(tl.id_empleado, new Map())
    const mmap = empMonthMinutes.get(tl.id_empleado)!
    mmap.set(mes, (mmap.get(mes) ?? 0) + tl.minutos)
  }

  // costeDeptMap: empId_mes → coste imputado al departamento
  const costeDeptMap = new Map<string, number>()
  const dedicMap = new Map<string, number>()
  for (const d of dedicacionList) {
    dedicMap.set(`${d.id_empleado}_${d.mes}`, d.porcentaje)
    const sueldo = sueldoMap.get(`${d.id_empleado}_${d.mes}`) ?? 0
    costeDeptMap.set(`${d.id_empleado}_${d.mes}`, sueldo * d.porcentaje / 100)
  }

  // --- CLIENT-CENTRIC DATA ---
  // servicioClienteMap: servicioId → { id, nombre }
  const servicioClienteMap = new Map<string, { id: string; nombre: string }>()
  for (const s of serviciosList) {
    const cli = s.cliente as { id: string; nombre: string } | null
    if (cli) servicioClienteMap.set(s.id, cli)
  }

  // Ingresos per cliente
  const ingresosPerCliente = new Map<string, number>()
  const clienteNombreMap = new Map<string, string>()
  for (const ing of ingresosList) {
    if (!ing.id_servicio) continue
    const cli = servicioClienteMap.get(ing.id_servicio)
    if (!cli) continue
    clienteNombreMap.set(cli.id, cli.nombre)
    ingresosPerCliente.set(cli.id, (ingresosPerCliente.get(cli.id) ?? 0) + Number(ing.valor))
  }

  // Group time_logs by cliente → empId
  interface EmpClienteData { nombre: string; minutos: number; coste: number; fichajes: FichajeEntry[] }
  const clienteEmpMap = new Map<string, Map<string, EmpClienteData>>()

  for (const tl of timeLogsList) {
    const svc = tl.servicio as { cliente: { id: string; nombre: string } | null } | null
    const cliFromSvc = svc?.cliente
    const cliFromDirect = tl.cliente as { id: string; nombre: string } | null
    const cliId = cliFromSvc?.id ?? cliFromDirect?.id ?? null
    const cliNombre = cliFromSvc?.nombre ?? cliFromDirect?.nombre ?? null
    if (!cliId || !cliNombre) continue

    clienteNombreMap.set(cliId, cliNombre)

    const mes = parseInt(tl.fecha.substring(5, 7))
    const minDept = empMonthMinutes.get(tl.id_empleado)?.get(mes) ?? 0
    const costeDept = costeDeptMap.get(`${tl.id_empleado}_${mes}`) ?? 0
    const costeEntry = minDept > 0 ? costeDept * (tl.minutos / minDept) : 0

    if (!clienteEmpMap.has(cliId)) clienteEmpMap.set(cliId, new Map())
    const empMap = clienteEmpMap.get(cliId)!
    if (!empMap.has(tl.id_empleado)) {
      empMap.set(tl.id_empleado, {
        nombre: empNameMap.get(tl.id_empleado) ?? tl.id_empleado,
        minutos: 0,
        coste: 0,
        fichajes: [],
      })
    }
    const empData = empMap.get(tl.id_empleado)!
    empData.minutos += tl.minutos
    empData.coste += costeEntry
    empData.fichajes.push({ fecha: tl.fecha, descripcion: tl.descripcion, minutos: tl.minutos })
  }

  interface ClienteCard {
    clienteId: string
    clienteNombre: string
    ingresos: number
    minutos: number
    coste: number
    empleados: (EmpClienteData & { empId: string })[]
  }

  const allClienteIds = new Set([...clienteEmpMap.keys(), ...ingresosPerCliente.keys()])
  const clienteCards: ClienteCard[] = Array.from(allClienteIds).map(cliId => {
    const empMap = clienteEmpMap.get(cliId) ?? new Map()
    const empleados = Array.from(empMap.entries())
      .map(([empId, data]) => ({
        empId,
        ...data,
        fichajes: data.fichajes.sort((a: FichajeEntry, b: FichajeEntry) => a.fecha.localeCompare(b.fecha)),
      }))
      .sort((a, b) => b.minutos - a.minutos)
    return {
      clienteId: cliId,
      clienteNombre: clienteNombreMap.get(cliId) ?? cliId,
      ingresos: ingresosPerCliente.get(cliId) ?? 0,
      minutos: empleados.reduce((s, e) => s + e.minutos, 0),
      coste: empleados.reduce((s, e) => s + e.coste, 0),
      empleados,
    }
  }).sort((a, b) => (b.ingresos - a.ingresos) || (b.minutos - a.minutos))

  // Totals (from dedicacionList for KPIs)
  const costePersonalTotal = dedicacionList.reduce((s, d) => {
    return s + (sueldoMap.get(`${d.id_empleado}_${d.mes}`) ?? 0) * d.porcentaje / 100
  }, 0)
  const ingresosTotal = ingresosList.reduce((s, i) => s + Number(i.valor), 0)
  const gastosPropiosTotal = gastosList.reduce((s, g) => s + Number(g.valor), 0)
  const costeTotalGeneral = costePersonalTotal + gastosPropiosTotal
  const resultado = ingresosTotal - costeTotalGeneral
  const margenPct = ingresosTotal > 0 ? (resultado / ingresosTotal) * 100 : 0

  // Monthly breakdown
  const monthlyRows = Array.from({ length: mesHasta - mesDesde + 1 }, (_, i) => {
    const mes = mesDesde + i
    const ingresosMes = ingresosList.filter(x => x.mes === mes).reduce((s, x) => s + Number(x.valor), 0)
    const gastosMes = gastosList.filter(x => x.mes === mes).reduce((s, x) => s + Number(x.valor), 0)
    const costPersonalMes = dedicacionList
      .filter(d => d.mes === mes)
      .reduce((s, d) => s + (sueldoMap.get(`${d.id_empleado}_${mes}`) ?? 0) * d.porcentaje / 100, 0)
    return { mes, ingresosMes, gastosMes, costPersonalMes, resultadoMes: ingresosMes - gastosMes - costPersonalMes }
  })

  // empMonthMap for legacy use (services table)
  const empMonthMap = new Map<string, Map<number, Map<string, ProjectEntry>>>()
  for (const tl of timeLogsList) {
    const empId = tl.id_empleado
    const mes = parseInt(tl.fecha.substring(5, 7))
    const svc = tl.servicio as { nombre: string | null; notas: string | null; cliente: { nombre: string } | null } | null
    const clienteDirecto = (tl.cliente as { nombre: string } | null)?.nombre ?? null
    const clienteNombre = svc?.cliente?.nombre ?? clienteDirecto ?? null
    const svcNombre = svc?.notas ?? svc?.nombre ?? null
    const label = clienteNombre && svcNombre ? `${clienteNombre} · ${svcNombre}` : clienteNombre ?? svcNombre ?? 'Sin proyecto'
    const svcKey = tl.id_servicio ?? (tl.id_cliente ? `cliente_${tl.id_cliente}` : '__none__')
    if (!empMonthMap.has(empId)) empMonthMap.set(empId, new Map())
    const monthMap = empMonthMap.get(empId)!
    if (!monthMap.has(mes)) monthMap.set(mes, new Map())
    const projMap = monthMap.get(mes)!
    if (!projMap.has(svcKey)) projMap.set(svcKey, { label, logs: [] })
    projMap.get(svcKey)!.logs.push({ fecha: tl.fecha, descripcion: tl.descripcion, minutos: tl.minutos })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Link href="/departamentos" className="text-gray-500 hover:text-gray-300 text-sm transition-colors inline-flex items-center gap-1 mb-3">
          ← Departamentos
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">{dept.nombre}</h2>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${dept.activo ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'}`}>
            {dept.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <p className="text-gray-500 text-sm mt-1">
          {mesDesde === 1 && mesHasta === 12 ? `Año ${anio}` : `${MESES_CORTO[mesDesde-1]}–${MESES_CORTO[mesHasta-1]} ${anio}`} · Vista de rentabilidad
        </p>
      </div>
      <Suspense>
        <FiltroPeriodo anio={anio} mesDesde={mesDesde} mesHasta={mesHasta} />
      </Suspense>

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

      {/* POR CLIENTE — sección principal */}
      <div className="space-y-4">
        <div>
          <h3 className="text-white font-semibold text-lg">Por cliente</h3>
          <p className="text-gray-500 text-xs mt-0.5">Ingreso, coste y horas invertidas por cliente · empleados y fichajes dentro de cada uno</p>
        </div>

        {clienteCards.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl py-8 text-center">
            <p className="text-gray-500 text-sm">Sin datos de clientes para este periodo</p>
          </div>
        ) : (
          clienteCards.map(c => {
            const margen = c.ingresos - c.coste
            const margenPctCard = c.ingresos > 0 ? (margen / c.ingresos) * 100 : null
            return (
              <div key={c.clienteId} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Cliente header */}
                <div className="px-6 py-4 border-b border-gray-800 bg-gray-800/20">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h4 className="text-white font-semibold text-base">{c.clienteNombre}</h4>
                    <div className="flex flex-wrap gap-5">
                      <div className="text-right">
                        <p className="text-gray-500 text-[10px] uppercase tracking-wide">Ingreso</p>
                        <p className={`font-bold text-sm ${c.ingresos > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                          {c.ingresos > 0 ? fmt(c.ingresos) : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-[10px] uppercase tracking-wide">Horas</p>
                        <p className="text-blue-400 font-bold text-sm">{c.minutos > 0 ? fmtMin(c.minutos) : '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-[10px] uppercase tracking-wide">Coste</p>
                        <p className="text-orange-400 font-bold text-sm">{c.coste > 0 ? fmt(c.coste) : '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-[10px] uppercase tracking-wide">Margen</p>
                        <p className={`font-bold text-sm ${margen >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {margenPctCard !== null
                            ? `${fmt(margen)} (${margenPctCard.toFixed(0)}%)`
                            : c.coste > 0 ? fmt(-c.coste) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Per employee */}
                <div className="divide-y divide-gray-800/50">
                  {c.empleados.map(emp => {
                    const empPct = c.minutos > 0 ? (emp.minutos / c.minutos) * 100 : 0
                    return (
                      <div key={emp.empId} className="px-6 py-4">
                        {/* Employee summary */}
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <span className="text-gray-200 font-medium text-sm min-w-[120px]">{emp.nombre}</span>
                          <span className="text-[11px] bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full">
                            {fmtMin(emp.minutos)}
                          </span>
                          {c.minutos > 0 && (
                            <span className="text-[11px] text-gray-500">{empPct.toFixed(0)}% de horas</span>
                          )}
                          <span className="text-[11px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">
                            {fmt(emp.coste)} coste
                          </span>
                        </div>

                        {/* Fichajes */}
                        {emp.fichajes.length > 0 && (
                          <div className="ml-0 mt-1 border border-gray-800/60 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <tbody>
                                {emp.fichajes.map((f, fi) => (
                                  <tr key={fi} className="border-b border-gray-800/40 last:border-0 hover:bg-gray-800/30">
                                    <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap w-20">
                                      {new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                    </td>
                                    <td className="px-3 py-1.5 text-gray-400">{f.descripcion ?? '—'}</td>
                                    <td className="px-3 py-1.5 text-right text-blue-400/80 whitespace-nowrap w-16">{fmtMin(f.minutos)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
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
