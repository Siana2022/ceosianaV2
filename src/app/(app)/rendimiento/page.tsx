import { createClient } from '@/lib/server/supabase'
import { getDedicacionCalculada } from '@/lib/server/dedicacionCalculada'
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
  costeAsignado: number   // sueldo × ded% / numServicios ese mes
  horasFichadas: number   // from time_logs
  facturacion: number     // ingresos × responsable%/100
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
    dedicacionRaw,
    { data: responsablesRaw },
    { data: serviciosRaw },
    { data: ingresosRaw },
    { data: timeLogsRaw },
    { data: empleadosRaw },
  ] = await Promise.all([
    supabase.from('sueldos').select('id_empleado, coste_total, mes').eq('anio', anio),
    getDedicacionCalculada(supabase, { anio }),
    supabase.from('servicio_responsables').select('id_servicio, id_empleado, porcentaje, mes').eq('anio', anio),
    supabase.from('servicios').select('id, nombre, notas, id_departamento, cliente:id_cliente(id, nombre), departamento:id_departamento(id, nombre)'),
    supabase.from('ingresos').select('id_servicio, valor, mes').eq('anio', anio),
    supabase.from('time_logs').select('id_empleado, id_servicio, minutos, fecha').gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`),
    supabase.from('empleados').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  // Maps
  const empNameMap = new Map((empleadosRaw ?? []).map(e => [e.id, e.nombre]))

  // sueldo: empId_mes → coste_total
  const sueldoMap = new Map<string, number>()
  for (const s of sueldosRaw ?? []) {
    sueldoMap.set(`${s.id_empleado}_${s.mes}`, Number(s.coste_total ?? 0))
  }

  // ingresos: servicioId_mes → valor
  const ingresosMap = new Map<string, number>()
  for (const i of ingresosRaw ?? []) {
    if (i.id_servicio) ingresosMap.set(`${i.id_servicio}_${i.mes}`, Number(i.valor))
  }

  // time_logs: empId_servicioId_mes → minutos
  const timeMap = new Map<string, number>()
  for (const t of timeLogsRaw ?? []) {
    if (!t.id_servicio) continue
    const mes = new Date(t.fecha + 'T12:00:00').getMonth() + 1
    const key = `${t.id_empleado}_${t.id_servicio}_${mes}`
    timeMap.set(key, (timeMap.get(key) ?? 0) + t.minutos)
  }

  // servicio info
  const servicioMap = new Map<string, { nombre: string; clienteId: string; clienteNombre: string; deptNombre: string; deptId: string }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviciosRaw ?? []).map((s: any) => {
      const cliente = Array.isArray(s.cliente) ? s.cliente[0] : s.cliente
      const dept = Array.isArray(s.departamento) ? s.departamento[0] : s.departamento
      return [s.id, {
        nombre: s.notas ?? s.nombre ?? s.id,
        clienteId: cliente?.id ?? '',
        clienteNombre: cliente?.nombre ?? '—',
        deptNombre: dept?.nombre ?? '—',
        deptId: s.id_departamento ?? '',
      }]
    })
  )

  // numServicios per empId_deptId_mes (for cost split) — misma clave (id de departamento) que dedicMap
  const numServMap = new Map<string, number>()
  for (const r of responsablesRaw ?? []) {
    const s = servicioMap.get(r.id_servicio)
    if (!s) continue
    const key = `${r.id_empleado}_${s.deptId}_${r.mes}`
    numServMap.set(key, (numServMap.get(key) ?? 0) + 1)
  }

  // dedicación (calculada a partir del fichaje) por empId_deptId_mes
  const dedicMap = new Map<string, number>()
  for (const d of dedicacionRaw) {
    dedicMap.set(`${d.id_empleado}_${d.id_departamento}_${d.mes}`, Number(d.porcentaje))
  }

  // Build rows — one per (empId, servicioId, mes)
  const rowsMap = new Map<string, RendimientoRow>()

  for (const r of responsablesRaw ?? []) {
    const sInfo = servicioMap.get(r.id_servicio)
    if (!sInfo) continue
    const empNombre = empNameMap.get(r.id_empleado) ?? r.id_empleado

    const sueldo = sueldoMap.get(`${r.id_empleado}_${r.mes}`) ?? 0
    const dedicacion = dedicMap.get(`${r.id_empleado}_${sInfo.deptId}_${r.mes}`) ?? 0
    const numServ = numServMap.get(`${r.id_empleado}_${sInfo.deptId}_${r.mes}`) ?? 1
    const costeAsignado = sueldo * dedicacion / 100 / numServ

    const ingresoValor = ingresosMap.get(`${r.id_servicio}_${r.mes}`) ?? 0
    const facturacion = ingresoValor * r.porcentaje / 100

    const minutos = timeMap.get(`${r.id_empleado}_${r.id_servicio}_${r.mes}`) ?? 0
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
