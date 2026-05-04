import { createClient } from '@/lib/server/supabase'
import DedicacionClient from './DedicacionClient'

export default async function DedicacionPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; anio?: string }>
}) {
  const { mes: mesParam, anio: anioParam } = await searchParams
  const anio = parseInt(anioParam ?? String(new Date().getFullYear()))
  const mes = mesParam ? parseInt(mesParam) : null
  const sinMes = mes === null

  const supabase = await createClient()

  const queryMes = mes ?? 1

  const [
    { data: empleados },
    { data: departamentos },
    { data: dedicacion },
  ] = await Promise.all([
    supabase.from('empleados').select('id, nombre, activo').order('nombre'),
    supabase.from('departamentos').select('id, nombre').eq('activo', true).order('nombre'),
    supabase
      .from('empleado_dedicacion')
      .select('*')
      .eq('anio', anio)
      .eq('mes', queryMes),
  ])

  return (
    <DedicacionClient
      empleados={empleados ?? []}
      departamentos={departamentos ?? []}
      dedicacion={dedicacion ?? []}
      mes={mes}
      anio={anio}
      sinMes={sinMes}
    />
  )
}
