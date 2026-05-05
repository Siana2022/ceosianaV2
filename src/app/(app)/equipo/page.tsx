import { createClient } from '@/lib/server/supabase'
import EquipoClient from './EquipoClient'

export default async function EquipoPage() {
  const year = new Date().getFullYear()
  const supabase = await createClient()

  const [
    { data: empleados },
    { data: sueldos },
    { data: responsables },
    { data: ingresos },
  ] = await Promise.all([
    supabase.from('empleados').select('id, nombre, email, activo, fecha_alta, fecha_baja').order('nombre'),
    supabase.from('sueldos').select('id_empleado, coste_total, mes, anio').eq('anio', year),
    supabase.from('servicio_responsables').select('id_servicio, id_empleado, porcentaje, mes, anio').eq('anio', year),
    supabase.from('ingresos').select('id_servicio, valor, mes, anio').eq('anio', year).not('id_servicio', 'is', null),
  ])

  // ingreso map: `${id_servicio}_${mes}` → valor
  const ingresoMap = new Map<string, number>()
  for (const ing of ingresos ?? []) {
    if (ing.id_servicio) ingresoMap.set(`${ing.id_servicio}_${ing.mes}`, Number(ing.valor))
  }

  // sueldo map: id_empleado → [{ coste_total, mes }]
  const sueldosByEmp = new Map<string, { coste_total: number; mes: number }[]>()
  for (const s of sueldos ?? []) {
    const arr = sueldosByEmp.get(s.id_empleado) ?? []
    arr.push({ coste_total: Number(s.coste_total), mes: s.mes })
    sueldosByEmp.set(s.id_empleado, arr)
  }

  type EmpleadoRow = {
    id: string
    nombre: string
    email: string | null
    activo: boolean
    fecha_alta: string | null
    fecha_baja: string | null
    sueldo_actual: number | null
    total_anual: number
    num_proyectos: number
    facturacion: number
    margen: number
    margen_pct: number
  }

  const empleadosWithStats: EmpleadoRow[] = (empleados ?? []).map(emp => {
    const arr = sueldosByEmp.get(emp.id) ?? []
    const sorted = [...arr].sort((a, b) => b.mes - a.mes)
    const sueldo_actual = sorted[0]?.coste_total ?? null
    const total_anual = arr.reduce((s, r) => s + r.coste_total, 0)

    const empResps = (responsables ?? []).filter(r => r.id_empleado === emp.id)
    const servicioIds = new Set(empResps.map(r => r.id_servicio))
    const num_proyectos = servicioIds.size

    let facturacion = 0
    for (const r of empResps) {
      const valor = ingresoMap.get(`${r.id_servicio}_${r.mes}`) ?? 0
      facturacion += valor * r.porcentaje / 100
    }

    const margen = facturacion - total_anual
    const margen_pct = facturacion > 0 ? (margen / facturacion) * 100 : 0

    return {
      id: emp.id, nombre: emp.nombre, email: emp.email,
      activo: emp.activo, fecha_alta: emp.fecha_alta, fecha_baja: emp.fecha_baja,
      sueldo_actual, total_anual, num_proyectos, facturacion, margen, margen_pct,
    }
  })

  return <EquipoClient empleados={empleadosWithStats} year={year} />
}
