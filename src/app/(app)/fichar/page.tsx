import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'
import { redirect } from 'next/navigation'
import FicharClient from './FicharClient'

export default async function FicharPage() {
  const perfilData = await getPerfil()
  // If no profile row exists, treat as admin (backward compat for existing users)
  const perfil = perfilData ?? { id: '', id_empleado: null, rol: 'admin' as const }

  const supabase = await createClient()

  // Fetch all services with client + department info for the selector
  const { data: servicios } = await supabase
    .from('servicios')
    .select('id, nombre, notas, id_departamento, departamento:id_departamento(id, nombre), cliente:id_cliente(id, nombre)')
    .eq('activo', true)
    .order('nombre')

  // Fetch all active departments
  const { data: departamentos } = await supabase
    .from('departamentos')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  // Fetch all active clients
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  // Fetch employee info if linked
  let empleadoNombre = 'Usuario'
  if (perfil.id_empleado) {
    const { data: emp } = await supabase
      .from('empleados')
      .select('nombre')
      .eq('id', perfil.id_empleado)
      .single()
    if (emp) empleadoNombre = emp.nombre
  }

  // Admin: fetch all employees for the team view
  let empleados: { id: string; nombre: string }[] = []
  if (perfil.rol === 'admin') {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
    empleados = data ?? []
  }

  // Fetch active tareas for linking fichajes
  const { data: tareas } = await supabase
    .from('tareas')
    .select('id, nombre, id_cliente, id_departamento, estado, minutos_acumulados')
    .in('estado', ['espera', 'en_curso', 'bloqueado'])
    .order('nombre')

  return (
    <FicharClient
      perfil={perfil}
      empleadoNombre={empleadoNombre}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      servicios={(servicios ?? []) as any[]}
      departamentos={departamentos ?? []}
      clientes={clientes ?? []}
      empleados={empleados}
      tareas={(tareas ?? []).map(t => ({ id: String(t.id), nombre: t.nombre as string, idCliente: t.id_cliente ? String(t.id_cliente) : null, idDepartamento: t.id_departamento ? String(t.id_departamento) : null, minutosAcumulados: (t.minutos_acumulados as number) ?? 0 }))}
    />
  )
}
