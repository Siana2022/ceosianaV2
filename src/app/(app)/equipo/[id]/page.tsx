import { createClient } from '@/lib/server/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import SueldosClient from './SueldosClient'
import DedicacionEmpleadoClient from './DedicacionEmpleadoClient'
import SueldoDedicacionClient from './SueldoDedicacionClient'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export default async function EmpleadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ anio?: string }>
}) {
  const { id } = await params
  const { anio: anioParam } = await searchParams
  const currentYear = new Date().getFullYear()
  const year = anioParam ? parseInt(anioParam) : currentYear
  const years = Array.from({ length: currentYear - 2023 + 2 }, (_, i) => 2023 + i)

  const supabase = await createClient()

  // Round 1: employee + all sueldos + responsables + dedicacion + departamentos (in parallel)
  const [{ data: empleado }, { data: sueldos }, { data: responsablesRaw }, { data: dedicacionRaw }, { data: departamentosRaw }, { data: allRespYear }, { data: allServiciosYear }] = await Promise.all([
    supabase
      .from('empleados')
      .select('id, nombre, email, activo, fecha_alta, fecha_baja')
      .eq('id', id)
      .single(),
    supabase
      .from('sueldos')
      .select('id, id_empleado, coste_total, mes, anio')
      .eq('id_empleado', id)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false }),
    supabase
      .from('servicio_responsables')
      .select('id_servicio, porcentaje, mes')
      .eq('id_empleado', id)
      .eq('anio', year),
    supabase
      .from('empleado_dedicacion')
      .select('id_departamento, porcentaje, mes')
      .eq('id_empleado', id)
      .eq('anio', year),
    supabase
      .from('departamentos')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('servicio_responsables')
      .select('id_servicio, id_empleado, mes')
      .eq('anio', year),
    supabase
      .from('servicios')
      .select('id, id_departamento'),
  ])

  if (!empleado) notFound()

  // Extract unique service IDs
  const servicioIds = [...new Set((responsablesRaw ?? []).map(r => r.id_servicio))]

  // Round 2: fetch service details + ingresos (in parallel, only if there are services)
  const [{ data: serviciosRaw }, { data: ingresosRaw }] = await Promise.all([
    servicioIds.length > 0
      ? supabase
          .from('servicios')
          .select('id, nombre, tipo, fecha_inicio, fecha_fin, cliente:clientes(id, nombre), departamento:departamentos(id, nombre)')
          .in('id', servicioIds)
      : Promise.resolve({ data: [] }),
    servicioIds.length > 0
      ? supabase
          .from('ingresos')
          .select('id_servicio, valor, mes')
          .eq('anio', year)
          .in('id_servicio', servicioIds)
      : Promise.resolve({ data: [] }),
  ])

  // Build maps
  const ingresoMap = new Map<string, number>()
  for (const ing of ingresosRaw ?? []) {
    if (ing.id_servicio) ingresoMap.set(`${ing.id_servicio}_${ing.mes}`, Number(ing.valor))
  }

  const servicioMap = new Map<string, { id: string; clienteNombre: string; servicioNombre: string; tipo: string; fecha_inicio: string | null; fecha_fin: string | null; id_departamento: string | null }>()
  for (const s of serviciosRaw ?? []) {
    const dep = (s.departamento as unknown as { id: string; nombre: string } | null)
    const cli = (s.cliente as unknown as { nombre: string } | null)
    servicioMap.set(s.id, {
      id: s.id,
      clienteNombre: cli?.nombre ?? '—',
      servicioNombre: dep?.nombre ?? s.nombre,
      tipo: s.tipo,
      fecha_inicio: s.fecha_inicio ?? null,
      fecha_fin: s.fecha_fin ?? null,
      id_departamento: dep?.id ?? null,
    })
  }

  // Salary for this year per month
  const sueldosAnio = (sueldos ?? []).filter(s => s.anio === year)
  const sueldoByMes = new Map<number, number>()
  for (const s of sueldosAnio) sueldoByMes.set(s.mes, Number(s.coste_total))

  // Responsables by month
  const respByMes = new Map<number, { id_servicio: string; porcentaje: number }[]>()
  for (const r of responsablesRaw ?? []) {
    const arr = respByMes.get(r.mes) ?? []
    arr.push({ id_servicio: r.id_servicio, porcentaje: r.porcentaje })
    respByMes.set(r.mes, arr)
  }

  // Monthly evolution
  type MonthData = {
    mes: number
    facturacion: number
    sueldo: number
    margen: number
    num_servicios: number
  }

  const monthData: MonthData[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const resps = respByMes.get(mes) ?? []
    const facturacion = resps.reduce((sum, r) => {
      const valor = ingresoMap.get(`${r.id_servicio}_${mes}`) ?? 0
      return sum + valor * r.porcentaje / 100
    }, 0)
    const sueldo = sueldoByMes.get(mes) ?? 0
    return {
      mes,
      facturacion,
      sueldo,
      margen: facturacion - sueldo,
      num_servicios: new Set(resps.map(r => r.id_servicio)).size,
    }
  })

  // Per-service stats
  type ServicioStats = {
    id: string
    clienteNombre: string
    servicioNombre: string
    tipo: string
    meses_activos: number
    facturacion: number
  }

  const servicioStats = new Map<string, ServicioStats>()
  for (const r of responsablesRaw ?? []) {
    const sInfo = servicioMap.get(r.id_servicio)
    if (!sInfo) continue
    const valor = ingresoMap.get(`${r.id_servicio}_${r.mes}`) ?? 0
    const atrib = valor * r.porcentaje / 100

    if (!servicioStats.has(r.id_servicio)) {
      servicioStats.set(r.id_servicio, {
        id: r.id_servicio,
        clienteNombre: sInfo.clienteNombre,
        servicioNombre: sInfo.servicioNombre,
        tipo: sInfo.tipo,
        meses_activos: 0,
        facturacion: 0,
      })
    }
    const st = servicioStats.get(r.id_servicio)!
    st.meses_activos++
    st.facturacion += atrib
  }

  const proyectos = [...servicioStats.values()].sort((a, b) => b.facturacion - a.facturacion)

  // Facturación atribuida por dept/mes
  const facturacionByDeptMes = new Map<string, number>()
  for (const r of responsablesRaw ?? []) {
    const sInfo = servicioMap.get(r.id_servicio)
    if (!sInfo?.id_departamento) continue
    const valor = ingresoMap.get(`${r.id_servicio}_${r.mes}`) ?? 0
    const atrib = valor * r.porcentaje / 100
    const key = `${sInfo.id_departamento}_${r.mes}`
    facturacionByDeptMes.set(key, (facturacionByDeptMes.get(key) ?? 0) + atrib)
  }

  // Build deptDedicacion for SueldoDedicacionClient
  type MesDedicacion = {
    mes: number
    sueldo: number
    dedicacionPct: number
    costeDept: number
    proyectos: { id: string; clienteNombre: string }[]
    costePorProyecto: number
    facturacion: number
    rentabilidad: number
  }

  const deptMesMap = new Map<string, Map<number, { sueldo: number; dedicacionPct: number; proyectos: { id: string; clienteNombre: string }[] }>>()

  for (const d of dedicacionRaw ?? []) {
    if (!deptMesMap.has(d.id_departamento)) deptMesMap.set(d.id_departamento, new Map())
    const sueldo = sueldoByMes.get(d.mes) ?? 0
    deptMesMap.get(d.id_departamento)!.set(d.mes, {
      sueldo,
      dedicacionPct: Number(d.porcentaje),
      proyectos: [],
    })
  }

  for (const r of responsablesRaw ?? []) {
    const sInfo = servicioMap.get(r.id_servicio)
    if (!sInfo?.id_departamento) continue
    const mesMap = deptMesMap.get(sInfo.id_departamento)
    if (!mesMap) continue
    const mesData = mesMap.get(r.mes)
    if (!mesData) continue
    if (!mesData.proyectos.find(p => p.id === r.id_servicio)) {
      mesData.proyectos.push({ id: r.id_servicio, clienteNombre: sInfo.clienteNombre })
    }
  }

  const deptDedicacion = (departamentosRaw ?? [])
    .filter(d => deptMesMap.has(d.id))
    .map(d => {
      const mesMap = deptMesMap.get(d.id)!
      const meses: MesDedicacion[] = []
      for (const [mes, data] of mesMap.entries()) {
        const costeDept = data.sueldo * data.dedicacionPct / 100
        const facturacion = facturacionByDeptMes.get(`${d.id}_${mes}`) ?? 0
        meses.push({
          mes,
          sueldo: data.sueldo,
          dedicacionPct: data.dedicacionPct,
          costeDept,
          proyectos: data.proyectos,
          costePorProyecto: data.proyectos.length > 0 ? costeDept / data.proyectos.length : 0,
          facturacion,
          rentabilidad: facturacion - costeDept,
        })
      }
      meses.sort((a, b) => a.mes - b.mes)
      return { deptId: d.id, deptNombre: d.nombre, meses }
    })

  // Build numServiciosByEmpDeptMes for coste imputado calculation
  // Map: `${emp}_${dept}_${mes}` → count of services that employee is responsible for in that dept/month
  const numServMap = new Map<string, number>()
  for (const r of allRespYear ?? []) {
    const s = (allServiciosYear ?? []).find((sv: { id: string; id_departamento: string | null }) => sv.id === r.id_servicio)
    if (!s?.id_departamento) continue
    const key = `${r.id_empleado}_${s.id_departamento}_${r.mes}`
    numServMap.set(key, (numServMap.get(key) ?? 0) + 1)
  }

  // Compute total imputated cost for this employee across all departments and months
  let costeImputadoTotal = 0
  const costeImputadoByMes = new Map<number, number>()
  for (const d of dedicacionRaw ?? []) {
    const sueldo = sueldoByMes.get(d.mes) ?? 0
    const numServ = numServMap.get(`${id}_${d.id_departamento}_${d.mes}`) ?? 1
    const coste = sueldo * Number(d.porcentaje) / 100 / numServ
    costeImputadoTotal += coste
    costeImputadoByMes.set(d.mes, (costeImputadoByMes.get(d.mes) ?? 0) + coste)
  }

  // Totals
  const totalFact = monthData.reduce((s, m) => s + m.facturacion, 0)
  const totalSueldo = monthData.reduce((s, m) => s + m.sueldo, 0)
  const totalRentabilidad = totalFact - costeImputadoTotal
  const rentabilidadPct = totalFact > 0 ? (totalRentabilidad / totalFact) * 100 : 0

  return (
    <div className="p-6 space-y-8">
      {/* Back */}
      <Link
        href="/equipo"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        ← Volver al equipo
      </Link>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{empleado.nombre}</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                empleado.activo
                  ? 'bg-green-900/50 text-green-400 border border-green-800'
                  : 'bg-red-900/50 text-red-400 border border-red-800'
              }`}>
                {empleado.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            {empleado.email && <p className="text-gray-400 text-sm mt-1">{empleado.email}</p>}
            <div className="text-sm text-gray-500 mt-1 space-x-4">
              {empleado.fecha_alta && <span>Alta: <span className="text-gray-400">{fmtDate(empleado.fecha_alta)}</span></span>}
              {empleado.fecha_baja && <span>Baja: <span className="text-gray-400">{fmtDate(empleado.fecha_baja)}</span></span>}
            </div>
          </div>
          {/* Year selector */}
          <div className="flex items-center gap-2">
            {years.map(y => (
              <a
                key={y}
                href={`?anio=${y}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  y === year ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {y}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Facturación atribuida</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(totalFact)}</p>
          <p className="text-gray-500 text-xs mt-0.5">según responsabilidad {year}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Sueldo</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(totalSueldo)}</p>
          <p className="text-gray-500 text-xs mt-0.5">coste total {year}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Rentabilidad</p>
          <p className={`text-2xl font-bold mt-1 ${totalRentabilidad >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(totalRentabilidad)}</p>
          <p className="text-gray-500 text-xs mt-0.5">ingresos atribuidos - coste imputado</p>
          <p className="text-gray-600 text-[10px] mt-0.5">{rentabilidadPct.toFixed(1)}% sobre fact.</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Proyectos</p>
          <p className="text-2xl font-bold text-white mt-1">{proyectos.length}</p>
          <p className="text-gray-500 text-xs mt-0.5">servicios activos {year}</p>
        </div>
      </div>

      {/* Projects table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Proyectos {year}</h3>
          <p className="text-gray-500 text-xs mt-0.5">Servicios con responsabilidad asignada</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-6 py-3">Cliente</th>
              <th className="text-left px-6 py-3">Servicio / Departamento</th>
              <th className="text-center px-4 py-3">Meses</th>
              <th className="text-right px-6 py-3">Facturación atribuida</th>
            </tr>
          </thead>
          <tbody>
            {proyectos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                  Sin proyectos asignados en {year}
                </td>
              </tr>
            )}
            {proyectos.map(p => (
              <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-6 py-3 text-white font-medium">{p.clienteNombre}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300">{p.servicioNombre}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      p.tipo === 'recurrente' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {p.tipo === 'recurrente' ? 'REC' : 'ONE'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-gray-400">{p.meses_activos}</td>
                <td className="px-6 py-3 text-right">
                  {p.facturacion > 0
                    ? <span className="text-white font-medium">{fmt(p.facturacion)}</span>
                    : <span className="text-gray-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          {proyectos.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-800/30">
                <td colSpan={3} className="px-6 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  Total facturación atribuida
                </td>
                <td className="px-6 py-3 text-right text-white font-bold">{fmt(totalFact)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Monthly evolution */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Evolución mensual {year}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-6 py-3">Mes</th>
                <th className="text-center px-4 py-3">Proyectos</th>
                <th className="text-right px-6 py-3">Facturación</th>
                <th className="text-right px-6 py-3">Sueldo</th>
                <th className="text-right px-6 py-3">Coste imputado</th>
                <th className="text-right px-6 py-3">Rentabilidad</th>
                <th className="text-right px-4 py-3">Rentab. %</th>
              </tr>
            </thead>
            <tbody>
              {monthData.map(m => {
                const costeImputadoMes = costeImputadoByMes.get(m.mes) ?? 0
                const rentabilidadMes = m.facturacion - costeImputadoMes
                const pct = m.facturacion > 0 ? (rentabilidadMes / m.facturacion) * 100 : 0
                const hasData = m.facturacion > 0 || m.sueldo > 0
                return (
                  <tr
                    key={m.mes}
                    className={`border-b border-gray-800/50 ${hasData ? 'hover:bg-gray-800/30' : ''}`}
                  >
                    <td className={`px-6 py-3 font-medium ${hasData ? 'text-white' : 'text-gray-600'}`}>
                      {MESES[m.mes - 1]}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.num_servicios > 0 ? <span className="text-gray-400">{m.num_servicios}</span> : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {m.facturacion > 0
                        ? <span className="text-white">{fmt(m.facturacion)}</span>
                        : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {m.sueldo > 0
                        ? <span className="text-gray-300">{fmt(m.sueldo)}</span>
                        : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {costeImputadoMes > 0
                        ? <span className="text-orange-400">{fmt(costeImputadoMes)}</span>
                        : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {hasData
                        ? <span className={`font-medium ${rentabilidadMes >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(rentabilidadMes)}</span>
                        : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {m.facturacion > 0
                        ? <span className={`text-sm ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pct.toFixed(1)}%</span>
                        : <span className="text-gray-700">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-800/30">
                <td className="px-6 py-3 text-gray-400 font-semibold text-xs uppercase tracking-wide">Total</td>
                <td className="px-4 py-3 text-center text-gray-400 font-medium">
                  {proyectos.length > 0 ? proyectos.length : '—'}
                </td>
                <td className="px-6 py-3 text-right text-white font-bold">{fmt(totalFact)}</td>
                <td className="px-6 py-3 text-right text-gray-300 font-bold">{fmt(totalSueldo)}</td>
                <td className="px-6 py-3 text-right text-orange-400 font-bold">{fmt(costeImputadoTotal)}</td>
                <td className="px-6 py-3 text-right font-bold">
                  <span className={totalRentabilidad >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(totalRentabilidad)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-sm font-medium ${rentabilidadPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {rentabilidadPct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Sueldo por dedicación */}
      <SueldoDedicacionClient deptDedicacion={deptDedicacion} year={year} />

      {/* Dedicacion section */}
      <DedicacionEmpleadoClient
        empleadoId={id}
        anio={year}
        departamentos={departamentosRaw ?? []}
        dedicacion={(dedicacionRaw ?? []).map(d => ({
          id_departamento: d.id_departamento,
          porcentaje: d.porcentaje,
          mes: d.mes,
        }))}
      />

      {/* Sueldos section */}
      <SueldosClient empleadoId={id} sueldos={sueldos ?? []} />
    </div>
  )
}
