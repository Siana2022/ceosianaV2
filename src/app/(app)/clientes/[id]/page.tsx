import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getConfiguracion } from '@/lib/server/configuracion'
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

  // ── Coste personal: basada en horas fichadas ──────────────────────────
  // Para cada empleado que ficha horas a este cliente:
  //   coste = (minutos_cliente_mes / minutos_total_empleado_mes) × sueldo_mes
  const adminForData = createAdminClient()

  // Paginate time_logs for THIS client (to display + compute cost)
  const timeLogsRawArr: {
    id_empleado: string; id_servicio: string | null; id_departamento: string | null
    minutos: number; fecha: string; descripcion: string
    empleado: { id: string; nombre: string } | null
    servicio: { id: string; nombre: string | null; notas: string | null } | null
    departamento: { id: string; nombre: string } | null
  }[] = []
  {
    const PAGE = 1000; let from = 0
    while (true) {
      const { data } = await adminForData.from('time_logs')
        .select('id_empleado, id_servicio, id_departamento, minutos, fecha, descripcion, empleado:id_empleado(id, nombre), servicio:id_servicio(id, nombre, notas), departamento:id_departamento(id, nombre)')
        .eq('id_cliente', id)
        .gte('fecha', `${year}-01-01`)
        .lte('fecha', `${year}-12-31`)
        .range(from, from + PAGE - 1)
      if (!data?.length) break
      timeLogsRawArr.push(...(data as unknown as typeof timeLogsRawArr))
      if (data.length < PAGE) break
      from += PAGE
    }
  }
  const timeLogsRaw = timeLogsRawArr

  // Sueldos con adminClient para evitar RLS (empleados no ven sueldos ajenos)
  const { data: sueldosData } = await adminForData
    .from('sueldos')
    .select('id_empleado, coste_total, mes')
    .eq('anio', year)

  // Paginamos para superar el límite de 1000 filas de PostgREST
  const adminForTotals = createAdminClient()
  const totalTimeLogsRaw: { id_empleado: string; minutos: number; fecha: string }[] = []
  {
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data } = await adminForTotals
        .from('time_logs')
        .select('id_empleado, minutos, fecha')
        .gte('fecha', `${year}-01-01`)
        .lte('fecha', `${year}-12-31`)
        .order('fecha', { ascending: true })
        .range(from, from + PAGE - 1)
      if (!data?.length) break
      totalTimeLogsRaw.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  // sueldoMap: `${id_empleado}_${mes}` -> coste_total
  const sueldoMap = new Map<string, number>()
  for (const s of sueldosData ?? []) {
    sueldoMap.set(`${s.id_empleado}_${s.mes}`, Number(s.coste_total))
  }

  // totalMinutosByEmpMes: `${id_empleado}_${mes}` -> total minutos (todos los clientes)
  const totalMinutosByEmpMes = new Map<string, number>()
  for (const t of totalTimeLogsRaw ?? []) {
    const mes = parseInt(t.fecha.substring(5, 7))
    const key = `${t.id_empleado}_${mes}`
    totalMinutosByEmpMes.set(key, (totalMinutosByEmpMes.get(key) ?? 0) + t.minutos)
  }

  // clienteMinutosByEmpMes: `${id_empleado}_${mes}` -> minutos fichados a este cliente
  const clienteMinutosByEmpMes = new Map<string, number>()
  for (const t of timeLogsRaw ?? []) {
    const mes = parseInt((t as { fecha: string }).fecha.substring(5, 7))
    const empId = (t as { id_empleado: string }).id_empleado
    const key = `${empId}_${mes}`
    clienteMinutosByEmpMes.set(key, (clienteMinutosByEmpMes.get(key) ?? 0) + (t as { minutos: number }).minutos)
  }

  // Compute coste_personal
  let coste_personal = 0
  for (const [key, minutosCliente] of clienteMinutosByEmpMes) {
    const lastUnderscore = key.lastIndexOf('_')
    const empId = key.substring(0, lastUnderscore)
    const mes = parseInt(key.substring(lastUnderscore + 1))
    const totalMinutos = totalMinutosByEmpMes.get(key) ?? 0
    if (totalMinutos === 0) continue
    const sueldo = sueldoMap.get(`${empId}_${mes}`) ?? 0
    coste_personal += sueldo * (minutosCliente / totalMinutos)
  }

  // ── rentabilidadServicios: basada en time_logs por servicio ───────────

  // factByServicioMes (construido primero para poder resolver dept → servicio)
  const factByServicioMes = new Map<string, Map<number, number>>()
  for (const ing of ingresos ?? []) {
    if (!ing.id_servicio) continue
    if (!factByServicioMes.has(ing.id_servicio)) factByServicioMes.set(ing.id_servicio, new Map())
    factByServicioMes.get(ing.id_servicio)!.set(ing.mes, (factByServicioMes.get(ing.id_servicio)!.get(ing.mes) ?? 0) + Number(ing.valor))
  }

  // Para logs sin id_servicio: si el departamento tiene exactamente 1 servicio con facturación ese mes, le imputamos el coste
  const deptMonthToServices = new Map<string, Map<number, string[]>>()
  for (const s of servicios ?? []) {
    const sAny = s as { id: string; id_departamento?: string | null }
    if (!sAny.id_departamento) continue
    const mesFact = factByServicioMes.get(sAny.id) ?? new Map()
    let monthMap = deptMonthToServices.get(sAny.id_departamento)
    if (!monthMap) { monthMap = new Map(); deptMonthToServices.set(sAny.id_departamento, monthMap) }
    for (const mes of mesFact.keys()) {
      const arr = monthMap.get(mes) ?? []
      if (!arr.includes(sAny.id)) arr.push(sAny.id)
      monthMap.set(mes, arr)
    }
  }

  // costeByServicioMes: Map<servicioId, Map<mes, Map<empId, {nombre, coste}>>>
  const costeByServicioMes = new Map<string, Map<number, Map<string, { nombre: string; coste: number }>>>()
  const empNombreMap = new Map<string, string>()
  for (const e of empleados ?? []) empNombreMap.set(e.id, e.nombre)

  for (const t of timeLogsRaw ?? []) {
    const tl = t as { id_empleado: string; id_servicio: string | null; id_departamento: string | null; minutos: number; fecha: string }
    const mes = parseInt(tl.fecha.substring(5, 7))

    // Resolver servicio: directo o por departamento (si hay exactamente 1 con facturación ese mes)
    let svcId = tl.id_servicio
    if (!svcId && tl.id_departamento) {
      const candidates = deptMonthToServices.get(tl.id_departamento)?.get(mes)
      if (candidates?.length === 1) svcId = candidates[0]
    }
    if (!svcId) continue

    const key = `${tl.id_empleado}_${mes}`
    const totalMinutos = totalMinutosByEmpMes.get(key) ?? 0
    if (totalMinutos === 0) continue
    const sueldo = sueldoMap.get(`${tl.id_empleado}_${mes}`) ?? 0
    const coste = sueldo * (tl.minutos / totalMinutos)

    if (!costeByServicioMes.has(svcId)) costeByServicioMes.set(svcId, new Map())
    const mesMap = costeByServicioMes.get(svcId)!
    if (!mesMap.has(mes)) mesMap.set(mes, new Map())
    const empMap = mesMap.get(mes)!
    const existing = empMap.get(tl.id_empleado)
    empMap.set(tl.id_empleado, { nombre: empNombreMap.get(tl.id_empleado) ?? '', coste: (existing?.coste ?? 0) + coste })
  }

  const rentabilidadServicios = (servicios ?? []).map(s => {
    const mesCosteMap = costeByServicioMes.get(s.id) ?? new Map()
    const mesFact = factByServicioMes.get(s.id) ?? new Map()
    const allMeses = new Set<number>([...mesCosteMap.keys(), ...mesFact.keys()])
    const meses = [...allMeses].sort((a, b) => a - b).map(mes => ({
      mes,
      facturado: mesFact.get(mes) ?? 0,
      responsables: [...(mesCosteMap.get(mes) ?? new Map()).values()],
    }))
    return {
      id: s.id,
      nombre: s.nombre ?? '',
      idDepartamento: (s as { id_departamento?: string | null }).id_departamento ?? null,
      meses,
    }
  })

  // responsablesData vacío (ya no se usa, mantenemos la prop por compatibilidad)
  const responsablesData: { id_servicio: string; id_empleado: string; nombre: string; mes: number; anio: number; porcentaje: number }[] = []

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

  const config = await getConfiguracion()
  const umbralCostePorHora = parseFloat(config['coste_hora_umbral'] ?? '300') || 300

  const mrr = (servicios ?? [])
    .filter(s => s.activo && s.tipo === 'recurrente')
    .reduce((sum, s) => sum + Number(s.precio_base ?? 0), 0)

  const total_facturado = (ingresos ?? []).reduce((sum, i) => sum + Number(i.valor ?? 0), 0)
  const total_costes_directos = (gastos ?? []).reduce((sum, g) => sum + Number(g.valor ?? 0), 0)

  // Aggregate time_logs by employee for this client
  interface TimeLogCliente {
    id_empleado: string
    id_servicio: string | null
    id_departamento: string | null
    minutos: number
    fecha: string
    descripcion: string
    empleado: { id: string; nombre: string } | null
    servicio: { id: string; nombre: string | null; notas: string | null } | null
    departamento: { id: string; nombre: string } | null
  }
  const timeLogsCliente = (timeLogsRaw ?? []) as unknown as TimeLogCliente[]

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
      rentabilidadServicios={rentabilidadServicios}
      year={year}
      umbralCostePorHora={umbralCostePorHora}
      timeLogsCliente={timeLogsCliente}
    />
  )
}
