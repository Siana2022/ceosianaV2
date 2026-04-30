import { createClient } from '@/lib/server/supabase'
import ServiciosClient from './ServiciosClient'

export default async function ServiciosPage() {
  const supabase = await createClient()

  const [
    { data: servicios },
    { data: clientes },
    { data: departamentos },
    { data: empleados },
  ] = await Promise.all([
    supabase
      .from('servicios')
      .select('*, cliente:id_cliente(id,nombre), departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre)')
      .order('activo', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('departamentos').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('empleados').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  return (
    <ServiciosClient
      servicios={servicios || []}
      clientes={clientes || []}
      departamentos={departamentos || []}
      empleados={empleados || []}
    />
  )
}
