import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { redirect } from 'next/navigation'
import RendimientoClient from './RendimientoClient'

export interface RendimientoRow {
  empId: string
  empNombre: string
  servicioId: string
  servicioNombre: string
  clienteId: string
  clienteNombre: string
  deptNombre: string
  mes: number
  anio: number
  costeAsignado: number   // (minutos_servicio / minutos_totales_emp_mes) × sueldo
  horasFichadas: number   // from time_logs
  facturacion: number     // ingresos acumulados × responsable%/100
}

export default async function RendimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>
}) {
  const perfil = await getPerfil()
  const rol = perfil?.rol ?? 'admin'
  if (rol !== 'admin') redirect('/fichar')

  const { anio: anioParam } = await searchParams
  const anio = parseInt(anioParam ?? String(new Date().getFullYear()))

  const supabase = await createClient()

  const [
    { data: sueldosRaw },
    { data: responsablesRaw },
    { data: serviciosRaw },
    { data: ingresosRaw },
    { data: empleadosRaw },
  ] = await Promise.all([
    supabase.from('sueldos').select('id_empleado, coste_total, mes').eq('anio', anio),
    supabase.from('servicio_responsables').select('id_servicio, id_empleado, porcentaje, mes').eq('anio', anio),
    supabase.from('servicios').select('id, nombre, notas, id_departamento, cliente:id_cliente(id, nombre), departamento:id_departamento(id, nombre)'),
    supabase.from('ingresos').select('id_servicio, valor, mes').eq('anio', anio),
    supabase.from('empleados').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  // Paginate time_logs with admin client to bypass RLS and avoid row limit
  const admin = createAdminClient()
  const timeLogsRaw: { id_empleado: string; id_servicio: string | null; minutos: number; fecha: string }[] = []
  {
    const PAGE = 1000; let from = 0
    while (true) {
      const { data } = await admin.from('time_logs')
        .select('id_empleado, id_servicio, minutos, fecha')
        .gte('fecha', `${anio}-01-01`)
        .lte('fecha', `${anio}-12-31`)
        .range(from, from + PAGE - 1)
      if (!data?.length) break
      timeLogsRaw.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  // Maps
  const empNameMap = new Map((empleadosRaw ?? []).map(e => [e.id, e.nombre]))

  // sueldo: empId_mes → coste_total
  const sueldoMap = new Map<string, number>()
  for (const s of sueldosRaw ?? []) {
    sueldoMap.set(`${s.id_empleado}_${s.mes}`, Number(s.coste_total ?? 0))
  }

  // ingresos: acumulados por servicioId_mes (fix: suma en vez de sobreescribir)
  const ingresosMap = new Map<string, number>()
  for (const i of ingresosRaw ?? []) {
    if (i.id_servicio) {
      const k = `${i.id_servicio}_${i.mes}`
      ingresosMap.set(k, (ingresosMap.get(k) ?? 0) + Number(i.valor))
    }
  }

  // totalMinMap: empId_mes → total minutos fichados (todos los clientes/servicios)
  // timeMap: empId_servicioId_mes → minutos para ese servicio
  const totalMinMap = new Map<string, number>()
  const timeMap = new Map<string, number>()
  for (const t of timeLogsRaw) {
    const mes = new Date(t.fecha + 'T12:00:00').getMonth() + 1
    const totalKey = `${t.id_empleado}_${mes}`
    totalMinMap.set(totalKey, (totalMinMap.get(totalKey) ?? 0) + t.minutos)
    if (!t.id_servicio) continue
    const key = `${t.id_empleado}_${t.id_servicio}_${mes}`
    timeMap.set(key, (timeMap.get(key) ?? 0) + t.minutos)
  }

  // servicio info
  const servicioMap = new Map<string, { nombre: string; clienteId: string; clienteNombre: string; deptNombre: string }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviciosRaw ?? []).map((s: any) => {
      const cliente = Array.isArray(s.cliente) ? s.cliente[0] : s.cliente
      const dept = Array.isArray(s.departamento) ? s.departamento[0] : s.departamento
      return [s.id, {
        nombre: s.notas ?? s.nombre ?? s.id,
        clienteId: cliente?.id ?? '',
        clienteNombre: cliente?.nombre ?? '—',
        deptNombre: dept?.nombre ?? '—',
      }]
    })
  )

  // Build rows — one per (empId, servicioId, mes)
  const rowsMap = new Map<string, RendimientoRow>()

  for (const r of responsablesRaw ?? []) {
    const sInfo = servicioMap.get(r.id_servicio)
    if (!sInfo) continue
    const empNombre = empNameMap.get(r.id_empleado) ?? r.id_empleado

    const minutos = timeMap.get(`${r.id_empleado}_${r.id_servicio}_${r.mes}`) ?? 0
    const totalMin = totalMinMap.get(`${r.id_empleado}_${r.mes}`) ?? 0
    const sueldo = sueldoMap.get(`${r.id_empleado}_${r.mes}`) ?? 0
    const costeAsignado = totalMin > 0 ? sueldo * (minutos / totalMin) : 0

    const ingresoValor = ingresosMap.get(`${r.id_servicio}_${r.mes}`) ?? 0
    const facturacion = ingresoValor * r.porcentaje / 100

    const horasFichadas = minutos / 60

    const key = `${r.id_empleado}_${r.id_servicio}_${r.mes}`
    rowsMap.set(key, {
      empId: r.id_empleado,
      empNombre,
      servicioId: r.id_servicio,
      servicioNombre: sInfo.nombre,
      clienteId: sInfo.clienteId,
      clienteNombre: sInfo.clienteNombre,
      deptNombre: sInfo.deptNombre,
      mes: r.mes,
      anio,
      costeAsignado,
      horasFichadas,
      facturacion,
    })
  }

  const rows = Array.from(rowsMap.values())
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2023 + 2 }, (_, i) => 2023 + i)

  return <RendimientoClient rows={rows} anio={anio} years={years} />
}
