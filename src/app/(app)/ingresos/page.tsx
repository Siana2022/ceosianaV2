import { createClient } from '@/lib/server/supabase'
import IngresosClient from './IngresosClient'

export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; anio?: string }>
}) {
  const { mes: mesParam, anio: anioParam } = await searchParams
  const now = new Date()
  const anio = parseInt(anioParam ?? String(now.getFullYear()))
  const mes = parseInt(mesParam ?? String(now.getMonth() + 1))

  const supabase = await createClient()

  const [
    { data: ingresos },
    { data: serviciosActivos },
    { data: clientes },
    { data: departamentos },
    { data: empleados },
  ] = await Promise.all([
    supabase
      .from('ingresos')
      .select('*, cliente:id_cliente(id,nombre), servicio:id_servicio(id,nombre), departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre)')
      .eq('mes', mes)
      .eq('anio', anio)
      .order('concepto'),
    supabase
      .from('servicios')
      .select('id, id_cliente, nombre, notas, precio_base, id_departamento, id_responsable, tipo')
      .eq('activo', true)
      .eq('tipo', 'recurrente'),
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('departamentos').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('empleados').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  return (
    <IngresosClient
      ingresos={ingresos ?? []}
      serviciosActivos={serviciosActivos ?? []}
      clientes={clientes ?? []}
      departamentos={departamentos ?? []}
      empleados={empleados ?? []}
      mes={mes}
      anio={anio}
    />
  )
}
