import { createClient } from '@/lib/server/supabase'
import DedicacionClient from './DedicacionClient'

export default async function DedicacionPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>
}) {
  const { anio: anioParam } = await searchParams
  const anio = parseInt(anioParam ?? String(new Date().getFullYear()))

  const supabase = await createClient()

  const [
    { data: empleados },
    { data: departamentos },
    { data: dedicacion },
  ] = await Promise.all([
    supabase.from('empleados').select('id, nombre').order('nombre'),
    supabase.from('departamentos').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('empleado_dedicacion')
      .select('id_empleado, id_departamento, porcentaje, mes, anio')
      .eq('anio', anio),
  ])

  return (
    <DedicacionClient
      empleados={empleados ?? []}
      departamentos={departamentos ?? []}
      dedicacion={dedicacion ?? []}
      anio={anio}
    />
  )
}
