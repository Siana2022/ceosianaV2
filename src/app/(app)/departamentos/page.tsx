import { createClient } from '@/lib/server/supabase'
import DepartamentosClient from './DepartamentosClient'

export default async function DepartamentosPage() {
  const supabase = await createClient()

  const [
    { data: departamentosRaw },
    { data: empleados },
    { data: miembros },
  ] = await Promise.all([
    supabase.from('departamentos').select('id, nombre, activo').order('nombre'),
    supabase.from('empleados').select('id, nombre').eq('activo', true).order('nombre'),
    supabase
      .from('departamento_empleados')
      .select('id_departamento, id_empleado, empleado:id_empleado(id,nombre)'),
  ])

  // Build a map: departamento_id → [{id, nombre}]
  const miembrosMap = new Map<string, { id: string; nombre: string }[]>()
  for (const m of miembros ?? []) {
    const empRaw = m.empleado
    const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as { id: string; nombre: string } | null
    if (!emp) continue
    if (!miembrosMap.has(m.id_departamento)) miembrosMap.set(m.id_departamento, [])
    miembrosMap.get(m.id_departamento)!.push(emp)
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
