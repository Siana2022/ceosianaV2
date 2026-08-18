import { createClient } from '@/lib/server/supabase'
import { getDedicacionCalculada } from '@/lib/server/dedicacionCalculada'
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
    dedicacion,
  ] = await Promise.all([
    supabase.from('empleados').select('id, nombre').order('nombre'),
    supabase.from('departamentos').select('id, nombre').eq('activo', true).order('nombre'),
    getDedicacionCalculada(supabase, { anio }),
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
