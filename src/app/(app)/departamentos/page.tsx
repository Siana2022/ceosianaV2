import { createClient } from '@/lib/server/supabase'
import DepartamentosClient from './DepartamentosClient'

export default async function DepartamentosPage() {
  const supabase = await createClient()
  const anio = new Date().getFullYear()

  const [
    { data: departamentosRaw },
    { data: empleados },
    { data: miembros },
    { data: dedicacion },
  ] = await Promise.all([
    supabase.from('departamentos').select('id, nombre, activo').order('nombre'),
    supabase.from('empleados').select('id, nombre').eq('activo', true).order('nombre'),
    supabase
      .from('departamento_empleados')
      .select('id_departamento, id_empleado, empleado:id_empleado(id,nombre)'),
    supabase
      .from('empleado_dedicacion')
      .select('id_empleado, id_departamento, porcentaje')
      .eq('anio', anio)
      .eq('mes', new Date().getMonth() + 1),
  ])

  // Build dedicacion map: `${id_empleado}_${id_departamento}` → porcentaje
  const dedicacionMap = new Map<string, number>()
  for (const d of dedicacion ?? []) {
    dedicacionMap.set(`${d.id_empleado}_${d.id_departamento}`, d.porcentaje)
  }

  // Build a map: departamento_id → [{id, nombre, porcentaje}]
  const miembrosMap = new Map<string, { id: string; nombre: string; porcentaje: number }[]>()
  for (const m of miembros ?? []) {
    const empRaw = m.empleado
    const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as { id: string; nombre: string } | null
    if (!emp) continue
    if (!miembrosMap.has(m.id_departamento)) miembrosMap.set(m.id_departamento, [])
    const porcentaje = dedicacionMap.get(`${emp.id}_${m.id_departamento}`) ?? 0
    miembrosMap.get(m.id_departamento)!.push({ ...emp, porcentaje })
  }

  const departamentos = (departamentosRaw ?? []).map(d => ({
    ...d,
    miembros: miembrosMap.get(d.id) ?? [],
  }))

  return (
    <DepartamentosClient
      departamentos={departamentos}
      empleados={empleados ?? []}
    />
  )
}
