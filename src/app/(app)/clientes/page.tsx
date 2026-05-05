import { createClient } from '@/lib/server/supabase'
import ClientesClient from './ClientesClient'

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yearParam } = await searchParams
  const year = parseInt(yearParam ?? String(new Date().getFullYear()))

  const supabase = await createClient()

  const [
    { data: clientes },
    { data: servicios },
    { data: captacion },
    { data: ingresos },
    { data: gastosFijos },
    { data: responsables },
    { data: sueldos },
  ] = await Promise.all([
    supabase.from('clientes').select('*').order('nombre'),
    supabase.from('servicios').select('id, id_cliente, tipo, precio_base, activo'),
    supabase
      .from('captacion_clientes')
      .select('id_cliente, captador:id_captador(id,nombre), mantenedor:id_mantenedor(id,nombre)'),
    supabase
      .from('ingresos')
      .select('valor, mes, id_cliente')
      .eq('anio', year)
      .not('id_cliente', 'is', null),
    supabase
      .from('gastos_fijos')
      .select('valor, id_cliente')
      .eq('anio', year)
      .not('id_cliente', 'is', null),
    supabase
      .from('servicio_responsables')
      .select('id_servicio, id_empleado, porcentaje, mes')
      .eq('anio', year),
    supabase
      .from('sueldos')
      .select('id_empleado, coste_total, mes')
      .eq('anio', year),
  ])

  // Build a map of client_id -> mrr, num_servicios
  // Also service_id -> id_cliente map for responsables linkage
  const serviciosByCliente = new Map<string, { mrr: number; count: number }>()
  const servicioClienteMap = new Map<string, string>() // service_id → client_id
  for (const s of servicios ?? []) {
    if (!s.id_cliente) continue
    servicioClienteMap.set(s.id, s.id_cliente)
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

  // Gastos directos by client (comisiones + gastos cliente)
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

  // Coste personal by client: for each responsable of each service of this client,
  // sum over months of (sueldo_empleado_mes × responsable_pct/100)
  const costePersonalByCliente = new Map<string, number>()
  for (const r of responsables ?? []) {
    const clienteId = servicioClienteMap.get(r.id_servicio)
    if (!clienteId) continue
    const sueldo = sueldoMap.get(`${r.id_empleado}_${r.mes}`) ?? 0
    const coste = sueldo * r.porcentaje / 100
    costePersonalByCliente.set(clienteId, (costePersonalByCliente.get(clienteId) ?? 0) + coste)
  }

  const enriched = (clientes ?? []).map(c => {
    const ingresosTotal = ingresosByCliente.get(c.id) ?? 0
    const gastosDirectos = gastosByCliente.get(c.id) ?? 0
    const costePersonal = costePersonalByCliente.get(c.id) ?? 0
    const resultado = ingresosTotal - gastosDirectos - costePersonal
    const margenPct = ingresosTotal > 0 ? (resultado / ingresosTotal) * 100 : 0

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
    }
  })

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  return <ClientesClient clientes={enriched} year={year} years={years} />
}
