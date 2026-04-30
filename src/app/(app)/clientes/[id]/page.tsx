import { createClient } from '@/lib/server/supabase'
import { notFound } from 'next/navigation'
import ClienteDetailClient from './ClienteDetailClient'

export default async function ClienteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string }>
}) {
  const { id } = await params
  const { year: yearParam } = await searchParams
  const year = parseInt(yearParam ?? String(new Date().getFullYear()))

  const supabase = await createClient()

  const [
    { data: cliente },
    { data: servicios },
    { data: captacion },
    { data: ingresos },
    { data: empleados },
    { data: departamentos },
  ] = await Promise.all([
    supabase.from('clientes').select('*').eq('id', id).single(),
    supabase
      .from('servicios')
      .select('*, departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre)')
      .eq('id_cliente', id)
      .order('activo', { ascending: false })
      .order('nombre'),
    supabase
      .from('captacion_clientes')
      .select('*, captador:id_captador(id,nombre), mantenedor:id_mantenedor(id,nombre)')
      .eq('id_cliente', id)
      .order('fecha_inicio', { ascending: false })
      .limit(1),
    supabase
      .from('ingresos')
      .select('id, concepto, valor, mes, anio, id_servicio, id_departamento, id_responsable, notas')
      .eq('id_cliente', id)
      .eq('anio', year)
      .order('mes'),
    supabase.from('empleados').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('departamentos').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  if (!cliente) notFound()

  const mrr = (servicios ?? [])
    .filter(s => s.activo && s.tipo === 'recurrente')
    .reduce((sum, s) => sum + Number(s.precio_base ?? 0), 0)

  const total_facturado = (ingresos ?? []).reduce((sum, i) => sum + Number(i.valor ?? 0), 0)

  return (
    <ClienteDetailClient
      cliente={cliente}
      servicios={servicios ?? []}
      captacion={captacion?.[0] ?? null}
      ingresos={ingresos ?? []}
      empleados={empleados ?? []}
      departamentos={departamentos ?? []}
      mrr={mrr}
      total_facturado={total_facturado}
      year={year}
    />
  )
}
