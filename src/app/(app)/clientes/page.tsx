import { createClient } from '@/lib/server/supabase'
import { getDedicacionCalculada } from '@/lib/server/dedicacionCalculada'
import ClientesClient from './ClientesClient'

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const { year: yearParam, month: monthParam } = await searchParams
  const year = parseInt(yearParam ?? String(new Date().getFullYear()))
  const month = parseInt(monthParam ?? '0') || 0

  const supabase = await createClient()

  // Base queries (no month filter)
  const [
    { data: clientes },
    { data: servicios },
    { data: captacion },
    { data: responsables },
    { data: sueldos },
    dedicaciones,
  ] = await Promise.all([
    supabase.from('clientes').select('*').order('nombre'),
    supabase.from('servicios').select('id, id_cliente, id_departamento, tipo, precio_base, activo'),
    supabase
      .from('captacion_clientes')
      .select('id_cliente, captador:id_captador(id,nombre), mantenedor:id_mantenedor(id,nombre)'),
    supabase
      .from('servicio_responsables')
      .select('id_servicio, id_empleado, mes')
      .eq('anio', year),
    supabase
      .from('sueldos')
      .select('id_empleado, coste_total, mes')
      .eq('anio', year),
    getDedicacionCalculada(supabase, { anio: year }),
  ])

  // Month-filtered queries
  let ingresosQ = supabase
    .from('ingresos')
    .select('valor, mes, id_cliente')
    .eq('anio', year)
    .not('id_cliente', 'is', null)
  if (month > 0) ingresosQ = ingresosQ.eq('mes', month)
  const { data: ingresos } = await ingresosQ

  let gastosQ = supabase
    .from('gastos_fijos')
    .select('valor, id_cliente')
    .eq('anio', year)
    .not('id_cliente', 'is', null)
  if (month > 0) gastosQ = gastosQ.eq('mes', month)
  const { data: gastosFijos } = await gastosQ

  // Time logs for horas dedicadas per client
  const { data: timeLogs } = await supabase
    .from('time_logs')
    .select('id_cliente, minutos, fecha')
    .gte('fecha', `${year}-01-01`)
    .lte('fecha', `${year}-12-31`)
    .not('id_cliente', 'is', null)

  // Build a map of client_id -> mrr, num_servicios
  // Also service_id -> { id_cliente, id_departamento } map for responsables linkage
  const serviciosByCliente = new Map<string, { mrr: number; count: number }>()
  const servicioInfoMap = new Map<string, { id_cliente: string; id_departamento: string | null }>()
  for (const s of servicios ?? []) {
    if (!s.id_cliente) continue
    servicioInfoMap.set(s.id, { id_cliente: s.id_cliente, id_departamento: s.id_departamento ?? null })
    const cur = serviciosByCliente.get(s.id_cliente) ?? { mrr: 0, count: 0 }
    cur.count += 1
    if (s.activo && s.tipo === 'recurrente') {
      cur.mrr += Number(s.precio_base ?? 0)
    }
    serviciosByCliente.set(s.id_cliente, cur)
  }

  // Build captacion map (last entry wins)
  const captacionByCliente = new Map<string, { captador_nombre: string; mantenedor_nombre: string }>()
  for (const c of captacion ?? []) {
    captacionByCliente.set(c.id_cliente, {
      captador_nombre: (c.captador as unknown as { nombre: string } | null)?.nombre ?? '',
      mantenedor_nombre: (c.mantenedor as unknown as { nombre: string } | null)?.nombre ?? '',
    })
  }

  // Ingresos by client
  const ingresosByCliente = new Map<string, number>()
  for (const ing of ingresos ?? []) {
    if (!ing.id_cliente) continue
    ingresosByCliente.set(ing.id_cliente, (ingresosByCliente.get(ing.id_cliente) ?? 0) + Number(ing.valor))
  }

  // Gastos directos by client
  const gastosByCliente = new Map<string, number>()
  for (const g of gastosFijos ?? []) {
    if (!g.id_cliente) continue
    gastosByCliente.set(g.id_cliente, (gastosByCliente.get(g.id_cliente) ?? 0) + Number(g.valor))
  }

  // Sueldo map: `${id_empleado}_${mes}` → coste_total
  const sueldoMap = new Map<string, number>()
  for (const s of sueldos ?? []) {
    sueldoMap.set(`${s.id_empleado}_${s.mes}`, Number(s.coste_total))
  }

  // dedicacionMap: `${id_empleado}_${id_departamento}_${mes}` -> porcentaje
  const dedicacionMap = new Map<string, number>()
  for (const d of dedicaciones ?? []) {
    dedicacionMap.set(`${d.id_empleado}_${d.id_departamento}_${d.mes}`, Number(d.porcentaje))
  }

  // numServiciosMap: `${id_empleado}_${id_departamento}_${mes}` -> count of distinct services across ALL clients
  const numServiciosMap = new Map<string, number>()
  for (const r of responsables ?? []) {
    const info = servicioInfoMap.get(r.id_servicio)
    const deptId = info?.id_departamento
    if (!deptId) continue
    const key = `${r.id_empleado}_${deptId}_${r.mes}`
    numServiciosMap.set(key, (numServiciosMap.get(key) ?? 0) + 1)
  }

  // Coste personal by client filtered by month if set
  // Formula: sueldo(X, M) × dedicacion%(X, dept, M) / 100 / num_services(X, dept, M)
  const filteredResponsables = month > 0
    ? (responsables ?? []).filter(r => r.mes === month)
    : (responsables ?? [])

  // Minutos por cliente (con filtro de mes si aplica)
  const minutosByCliente = new Map<string, number>()
  for (const t of timeLogs ?? []) {
    if (!t.id_cliente) continue
    if (month > 0) {
      const tMes = new Date(t.fecha + 'T12:00:00').getMonth() + 1
      if (tMes !== month) continue
    }
    minutosByCliente.set(t.id_cliente, (minutosByCliente.get(t.id_cliente) ?? 0) + Number(t.minutos))
  }

  const costePersonalByCliente = new Map<string, number>()
  for (const r of filteredResponsables) {
    const info = servicioInfoMap.get(r.id_servicio)
    if (!info?.id_cliente) continue
    const deptId = info.id_departamento
    if (!deptId) continue
    const sueldo = sueldoMap.get(`${r.id_empleado}_${r.mes}`) ?? 0
    const dedicacion = dedicacionMap.get(`${r.id_empleado}_${deptId}_${r.mes}`) ?? 0
    const numServicios = numServiciosMap.get(`${r.id_empleado}_${deptId}_${r.mes}`) ?? 1
    const coste = sueldo * (dedicacion / 100) / numServicios
    costePersonalByCliente.set(info.id_cliente, (costePersonalByCliente.get(info.id_cliente) ?? 0) + coste)
  }

  const enriched = (clientes ?? []).map(c => {
    const ingresosTotal = ingresosByCliente.get(c.id) ?? 0
    const gastosDirectos = gastosByCliente.get(c.id) ?? 0
    const costePersonal = costePersonalByCliente.get(c.id) ?? 0
    const resultado = ingresosTotal - gastosDirectos - costePersonal
    const margenPct = ingresosTotal > 0 ? (resultado / ingresosTotal) * 100 : 0
    const horasDedicadas = (minutosByCliente.get(c.id) ?? 0) / 60
    const horasParaCalculo = horasDedicadas > 0 ? horasDedicadas : 1
    const costePorHora = ingresosTotal > 0 ? ingresosTotal / horasParaCalculo : null

    return {
      ...c,
      mrr: serviciosByCliente.get(c.id)?.mrr ?? 0,
      num_servicios: serviciosByCliente.get(c.id)?.count ?? 0,
      captador_nombre: captacionByCliente.get(c.id)?.captador_nombre ?? '',
      mantenedor_nombre: captacionByCliente.get(c.id)?.mantenedor_nombre ?? '',
      ingresos_total: ingresosTotal,
      gastos_directos: gastosDirectos,
      coste_personal: costePersonal,
      resultado,
      margen_pct: margenPct,
      horas_dedicadas: horasDedicadas,
      coste_por_hora: costePorHora,
    }
  })

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2023 + 2 }, (_, i) => 2023 + i)

  return <ClientesClient clientes={enriched} year={year} years={years} month={month} />
}
