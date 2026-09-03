import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getConfiguracion } from '@/lib/server/configuracion'
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
    { data: sueldos },
  ] = await Promise.all([
    supabase.from('clientes').select('*').order('nombre'),
    supabase.from('servicios').select('id, id_cliente, id_departamento, tipo, precio_base, activo'),
    supabase
      .from('captacion_clientes')
      .select('id_cliente, captador:id_captador(id,nombre), mantenedor:id_mantenedor(id,nombre)'),
    createAdminClient()
      .from('sueldos')
      .select('id_empleado, coste_total, mes')
      .eq('anio', year),
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

  // Para el % de dedicación: necesitamos todos los logs del año (sin filtro de mes)
  // Para las horas por cliente: solo el mes seleccionado (si lo hay)
  // Usamos dos queries para evitar el límite de 1000 filas de PostgREST
  const adminDb = createAdminClient()
  const [{ data: timeLogsAnio }, { data: timeLogsMes }] = await Promise.all([
    // Todos los del año (para totalMinutosByEmpMes): solo campos necesarios para el cálculo
    adminDb
      .from('time_logs')
      .select('id_empleado, minutos, fecha')
      .gte('fecha', `${year}-01-01`)
      .lte('fecha', `${year}-12-31`)
      .limit(9999),
    // Solo el mes seleccionado (para horas y coste por cliente): con id_cliente
    month > 0
      ? adminDb
          .from('time_logs')
          .select('id_cliente, id_empleado, minutos, fecha')
          .gte('fecha', `${year}-${String(month).padStart(2, '0')}-01`)
          .lte('fecha', `${year}-${String(month).padStart(2, '0')}-31`)
          .not('id_cliente', 'is', null)
          .limit(9999)
      : adminDb
          .from('time_logs')
          .select('id_cliente, id_empleado, minutos, fecha')
          .gte('fecha', `${year}-01-01`)
          .lte('fecha', `${year}-12-31`)
          .not('id_cliente', 'is', null)
          .limit(9999),
  ])

  // Total time logs por empleado (todos los clientes) para calcular % dedicación
  const totalMinutosByEmpMes = new Map<string, number>()
  for (const t of timeLogsAnio ?? []) {
    const mes = parseInt(t.fecha.substring(5, 7))
    const key = `${t.id_empleado}_${mes}`
    totalMinutosByEmpMes.set(key, (totalMinutosByEmpMes.get(key) ?? 0) + Number(t.minutos))
  }

  // Build a map of client_id -> mrr, num_servicios
  const serviciosByCliente = new Map<string, { mrr: number; count: number }>()
  for (const s of servicios ?? []) {
    if (!s.id_cliente) continue
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

  // Minutos por cliente y coste personal basado en horas fichadas
  // timeLogsMes ya viene filtrado por mes (o por año entero si month=0)
  const minutosByCliente = new Map<string, number>()
  const costePersonalByCliente = new Map<string, number>()
  for (const t of timeLogsMes ?? []) {
    if (!t.id_cliente) continue
    const mes = parseInt(t.fecha.substring(5, 7))
    minutosByCliente.set(t.id_cliente, (minutosByCliente.get(t.id_cliente) ?? 0) + Number(t.minutos))
    // Coste imputado = (minutos de este log / minutos totales del empleado ese mes) × sueldo
    const empKey = `${t.id_empleado}_${mes}`
    const totalMinutos = totalMinutosByEmpMes.get(empKey) ?? 0
    if (totalMinutos === 0) continue
    const sueldo = sueldoMap.get(empKey) ?? 0
    const coste = sueldo * (Number(t.minutos) / totalMinutos)
    costePersonalByCliente.set(t.id_cliente, (costePersonalByCliente.get(t.id_cliente) ?? 0) + coste)
  }

  const enriched = (clientes ?? []).map(c => {
    const ingresosTotal = ingresosByCliente.get(c.id) ?? 0
    const gastosDirectos = gastosByCliente.get(c.id) ?? 0
    const costePersonal = costePersonalByCliente.get(c.id) ?? 0
    const resultado = ingresosTotal - gastosDirectos - costePersonal
    const margenPct = ingresosTotal > 0 ? (resultado / ingresosTotal) * 100 : 0
    const horasDedicadas = (minutosByCliente.get(c.id) ?? 0) / 60
    const horasParaCalculo = Math.max(horasDedicadas, 1)
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

  const config = await getConfiguracion()
  const umbralCostePorHora = parseFloat(config['coste_hora_umbral'] ?? '300') || 300

  return <ClientesClient clientes={enriched} year={year} years={years} month={month} umbralCostePorHora={umbralCostePorHora} />
}
