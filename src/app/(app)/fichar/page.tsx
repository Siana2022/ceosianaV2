import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'
import { redirect } from 'next/navigation'
import FicharClient from './FicharClient'

export default async function FicharPage() {
  const perfil = await getPerfil()
  if (!perfil) redirect('/login')

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

  return (
    <FicharClient
      perfil={perfil}
      empleadoNombre={empleadoNombre}
      servicios={servicios ?? []}
      departamentos={departamentos ?? []}
      clientes={clientes ?? []}
      empleados={empleados}
    />
  )
}
