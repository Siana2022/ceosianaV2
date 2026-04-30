import { createClient } from '@/lib/server/supabase'
import EquipoClient from './EquipoClient'

export default async function EquipoPage() {
  const year = new Date().getFullYear()
  const supabase = await createClient()

  const [{ data: empleados }, { data: sueldos }] = await Promise.all([
    supabase.from('empleados').select('id, nombre, email, activo, fecha_alta, fecha_baja').order('nombre'),
    supabase.from('sueldos').select('id_empleado, coste_total, mes, anio').eq('anio', year),
  ])

  // Per-employee salary stats
  type EmpleadoRow = {
    id: string
    nombre: string
    email: string | null
    activo: boolean
    fecha_alta: string | null
    fecha_baja: string | null
    sueldo_actual: number | null
    total_anual: number
  }

  const sueldosByEmpleado = new Map<string, { coste_total: number; mes: number }[]>()
  for (const s of sueldos ?? []) {
    const arr = sueldosByEmpleado.get(s.id_empleado) ?? []
    arr.push({ coste_total: Number(s.coste_total), mes: s.mes })
    sueldosByEmpleado.set(s.id_empleado, arr)
  }

  const empleadosWithSueldo: EmpleadoRow[] = (empleados ?? []).map(e => {
    const arr = sueldosByEmpleado.get(e.id) ?? []
    const sorted = [...arr].sort((a, b) => b.mes - a.mes)
    const sueldo_actual = sorted[0]?.coste_total ?? null
    const total_anual = arr.reduce((s, r) => s + r.coste_total, 0)
    return {
      id: e.id,
      nombre: e.nombre,
      email: e.email,
      activo: e.activo,
      fecha_alta: e.fecha_alta,
      fecha_baja: e.fecha_baja,
      sueldo_actual,
      total_anual,
    }
  })

  return <EquipoClient empleados={empleadosWithSueldo} />
}
