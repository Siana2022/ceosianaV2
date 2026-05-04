import { createClient } from '@/lib/server/supabase'
import ServiciosClient from './ServiciosClient'

export default async function ServiciosPage() {
  const supabase = await createClient()

  const [
    { data: servicios },
    { data: clientes },
    { data: departamentos },
    { data: empleados },
    { data: responsablesBase },
    { data: miembrosDepto },
  ] = await Promise.all([
    supabase
      .from('servicios')
      .select('*, cliente:id_cliente(id,nombre), departamento:id_departamento(id,nombre)')
      .order('activo', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('departamentos').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('empleados').select('id, nombre').eq('activo', true).order('nombre'),
    // mes=0, anio=0 → service-level (non-monthly) base assignment
    supabase
      .from('servicio_responsables')
      .select('id_servicio, id_empleado, empleado:id_empleado(id,nombre)')
      .eq('mes', 0)
      .eq('anio', 0),
    supabase
      .from('departamento_empleados')
      .select('id_departamento, id_empleado, empleado:id_empleado(id,nombre)'),
  ])

  // Build responsables map: servicio_id → [{id, nombre}]
  const responsablesMap: Record<string, { id: string; nombre: string }[]> = {}
  for (const r of responsablesBase ?? []) {
    const empRaw = r.empleado
    const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as { id: string; nombre: string } | null
    if (!emp) continue
    if (!responsablesMap[r.id_servicio]) responsablesMap[r.id_servicio] = []
    responsablesMap[r.id_servicio].push(emp)
  }

  // Build empleadosPorDepartamento map
  const empleadosPorDepartamento: Record<string, { id: string; nombre: string }[]> = {}
  for (const m of miembrosDepto ?? []) {
    const empRaw = m.empleado
    const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as { id: string; nombre: string } | null
    if (!emp) continue
    if (!empleadosPorDepartamento[m.id_departamento]) empleadosPorDepartamento[m.id_departamento] = []
    empleadosPorDepartamento[m.id_departamento].push(emp)
  }

  // Attach responsables to each service
  const serviciosConResp = (servicios ?? []).map(s => ({
    ...s,
    responsables: responsablesMap[s.id] ?? [],
  }))

  return (
    <ServiciosClient
      servicios={serviciosConResp}
      clientes={clientes ?? []}
      departamentos={departamentos ?? []}
      empleados={empleados ?? []}
      empleadosPorDepartamento={empleadosPorDepartamento}
    />
  )
}
