import { createClient } from '@/lib/server/supabase'
import { notFound } from 'next/navigation'
import ClienteDetailClient from './ClienteDetailClient'

export default async function ClienteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string }>
}) {
  const { id } = await params
  const { year: yearParam } = await searchParams
  const year = parseInt(yearParam ?? String(new Date().getFullYear()))

  const supabase = await createClient()

  const [
    { data: cliente },
    { data: servicios },
    { data: captacion },
    { data: ingresos },
    { data: empleados },
    { data: departamentos },
    { data: gastos },
    { data: miembrosDepto },
    { data: todosConceptos },
  ] = await Promise.all([
    supabase.from('clientes').select('*').eq('id', id).single(),
    supabase
      .from('servicios')
      .select('*, departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre), tipo_servicio:id_tipo_servicio(id,nombre)')
      .eq('id_cliente', id)
      .order('activo', { ascending: false })
      .order('nombre'),
    supabase
      .from('captacion_clientes')
      .select('*, captador:id_captador(id,nombre), mantenedor:id_mantenedor(id,nombre)')
      .eq('id_cliente', id)
      .order('fecha_inicio', { ascending: false })
      .limit(1),
    supabase
      .from('ingresos')
      .select('id, concepto, valor, mes, anio, id_servicio, id_departamento, id_responsable, notas')
      .eq('id_cliente', id)
      .eq('anio', year)
      .order('mes'),
    supabase.from('empleados').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('departamentos').select('id, nombre').eq('activo', true).order('nombre'),
    supabase
      .from('gastos_fijos')
      .select('id, concepto, valor, mes, anio, tipo')
      .eq('id_cliente', id)
      .eq('anio', year)
      .order('mes'),
    supabase
      .from('departamento_empleados')
      .select('id_departamento, id_empleado, empleado:id_empleado(id,nombre)'),
    supabase.from('gastos_fijos').select('concepto, valor, tipo, id_departamento').order('anio', { ascending: false }).order('mes', { ascending: false }),
  ])

  if (!cliente) notFound()

  // Fetch responsables for all services of this client in this year
  const servicioIds = (servicios ?? []).map(s => s.id)
  let responsablesData: {
    id_servicio: string
    id_empleado: string
    nombre: string
    mes: number
    anio: number
    porcentaje: number
  }[] = []

  if (servicioIds.length > 0) {
    const { data: resps } = await supabase
      .from('servicio_responsables')
      .select('id_servicio, id_empleado, mes, anio, porcentaje, empleado:id_empleado(id,nombre)')
      .in('id_servicio', servicioIds)
      .eq('anio', year)

    responsablesData = (resps ?? []).map((r: Record<string, unknown>) => {
      // Supabase may return the join as an object OR as a single-element array
      const empRaw = r.empleado
      const emp = Array.isArray(empRaw)
        ? (empRaw[0] as { id: string; nombre: string } | undefined) ?? null
        : (empRaw as { id: string; nombre: string } | null)
      return {
        id_servicio: r.id_servicio as string,
        id_empleado: r.id_empleado as string,
        nombre: emp?.nombre ?? '',
        mes: r.mes as number,
        anio: r.anio as number,
        porcentaje: Number(r.porcentaje ?? 100),
      }
    })
  }

  // Fetch additional data needed for correct coste_personal formula:
  // ALL servicio_responsables for the year (all clients) — to compute num_services per (employee, dept, month)
  // ALL servicios with id_departamento — to map each service to its department
  // empleado_dedicacion — to get dedication % per (employee, dept, month)
  // sueldos — for all employees
  const [
    { data: allResponsablesRaw },
    { data: todosServicios },
    { data: dedicaciones },
    { data: sueldosData },
  ] = await Promise.all([
    supabase
      .from('servicio_responsables')
      .select('id_servicio, id_empleado, mes, anio')
      .eq('anio', year),
    supabase
      .from('servicios')
      .select('id, id_departamento'),
    supabase
      .from('empleado_dedicacion')
      .select('id_empleado, id_departamento, mes, anio, porcentaje')
      .eq('anio', year),
    supabase
      .from('sueldos')
      .select('id_empleado, coste_total, mes')
      .eq('anio', year),
  ])

  // servicioMap: id -> { id_departamento }
  const servicioMap = new Map<string, { id_departamento: string | null }>()
  for (const s of todosServicios ?? []) {
    servicioMap.set(s.id, { id_departamento: s.id_departamento ?? null })
  }

  // sueldoMap: `${id_empleado}_${mes}` -> coste_total
  const sueldoMap = new Map<string, number>()
  for (const s of sueldosData ?? []) {
    sueldoMap.set(`${s.id_empleado}_${s.mes}`, Number(s.coste_total))
  }

  // dedicacionMap: `${id_empleado}_${id_departamento}_${mes}` -> porcentaje
  const dedicacionMap = new Map<string, number>()
  for (const d of dedicaciones ?? []) {
    dedicacionMap.set(`${d.id_empleado}_${d.id_departamento}_${d.mes}`, Number(d.porcentaje))
  }

  // numServiciosMap: `${id_empleado}_${id_departamento}_${mes}` -> count of distinct services
  // Count across ALL clients (all servicio_responsables for the year)
  const numServiciosMap = new Map<string, number>()
  for (const r of allResponsablesRaw ?? []) {
    const servicio = servicioMap.get(r.id_servicio as string)
    const deptId = servicio?.id_departamento
    if (!deptId) continue
    const key = `${r.id_empleado}_${deptId}_${r.mes}`
    numServiciosMap.set(key, (numServiciosMap.get(key) ?? 0) + 1)
  }

  // Compute coste_personal using the correct formula:
  // cost = sueldo(X, M) × dedicacion%(X, dept, M) / 100 / num_services(X, dept, M)
  const clienteServicioIds = new Set(servicioIds)
  let coste_personal = 0
  for (const r of responsablesData) {
    if (!clienteServicioIds.has(r.id_servicio)) continue
    const servicio = servicioMap.get(r.id_servicio)
    const deptId = servicio?.id_departamento
    if (!deptId) continue
    const sueldo = sueldoMap.get(`${r.id_empleado}_${r.mes}`) ?? 0
    const dedicacion = dedicacionMap.get(`${r.id_empleado}_${deptId}_${r.mes}`) ?? 0
    const numServicios = numServiciosMap.get(`${r.id_empleado}_${deptId}_${r.mes}`) ?? 1
    coste_personal += sueldo * (dedicacion / 100) / numServicios
  }

  // Build empleadosPorDepartamento map
  const empleadosPorDepartamento: Record<string, { id: string; nombre: string }[]> = {}
  for (const m of miembrosDepto ?? []) {
    const empRaw = m.empleado
    const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as { id: string; nombre: string } | null
    if (!emp) continue
    if (!empleadosPorDepartamento[m.id_departamento]) {
      empleadosPorDepartamento[m.id_departamento] = []
    }
    empleadosPorDepartamento[m.id_departamento].push(emp)
  }

  // Build gastosExistentes: most recent value per concepto (sorted by anio+mes desc)
  const gastosRefMap = new Map<string, { valor: number; tipo: string; id_departamento: string | null }>()
  for (const g of todosConceptos ?? []) {
    if (!gastosRefMap.has(g.concepto)) {
      gastosRefMap.set(g.concepto, { valor: Number(g.valor), tipo: g.tipo ?? 'general', id_departamento: g.id_departamento ?? null })
    }
  }
  const gastosExistentes = Array.from(gastosRefMap.entries())
    .map(([concepto, data]) => ({ concepto, ...data }))
    .sort((a, b) => a.concepto.localeCompare(b.concepto))

  const mrr = (servicios ?? [])
    .filter(s => s.activo && s.tipo === 'recurrente')
    .reduce((sum, s) => sum + Number(s.precio_base ?? 0), 0)

  const total_facturado = (ingresos ?? []).reduce((sum, i) => sum + Number(i.valor ?? 0), 0)
  const total_costes_directos = (gastos ?? []).reduce((sum, g) => sum + Number(g.valor ?? 0), 0)

  return (
    <ClienteDetailClient
      cliente={cliente}
      servicios={servicios ?? []}
      captacion={captacion?.[0] ?? null}
      ingresos={ingresos ?? []}
      gastos={gastos ?? []}
      empleados={empleados ?? []}
      departamentos={departamentos ?? []}
      responsablesIniciales={responsablesData}
      empleadosPorDepartamento={empleadosPorDepartamento}
      gastosExistentes={gastosExistentes}
      mrr={mrr}
      total_facturado={total_facturado}
      total_costes={total_costes_directos}
      coste_personal={coste_personal}
      year={year}
    />
  )
}
