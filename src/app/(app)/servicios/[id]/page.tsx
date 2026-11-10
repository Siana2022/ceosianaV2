import { createClient } from '@/lib/server/supabase'
import { notFound } from 'next/navigation'
import TipoServicioDetailClient from './TipoServicioDetailClient'

export default async function TipoServicioDetailPage({
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
    { data: tipoServicio },
    { data: servicios },
  ] = await Promise.all([
    supabase.from('tipos_servicio').select('id, nombre').eq('id', id).single(),
    supabase
      .from('servicios')
      .select('id, nombre, tipo, precio_base, activo, fecha_inicio, fecha_fin, notas, cliente:id_cliente(id,nombre), departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre)')
      .eq('id_tipo_servicio', id)
      .order('activo', { ascending: false })
      .order('nombre'),
  ])

  if (!tipoServicio) notFound()

  // Query ingresos por los servicios de este tipo
  const servicioIds = (servicios ?? []).map(s => s.id)
  let ingresosData: { id_servicio: string | null; id_cliente: string | null; valor: number; mes: number; anio: number }[] = []
  if (servicioIds.length > 0) {
    const { data } = await supabase
      .from('ingresos')
      .select('id_servicio, id_cliente, valor, mes, anio')
      .eq('anio', year)
      .in('id_servicio', servicioIds)
    ingresosData = data ?? []
  }

  // Aggregate billing per service
  const factByServicio = new Map<string, number>()
  for (const ing of ingresosData) {
    if (!ing.id_servicio) continue
    factByServicio.set(ing.id_servicio, (factByServicio.get(ing.id_servicio) ?? 0) + Number(ing.valor))
  }

  // Group services by client
  type ClienteGroup = {
    id: string
    nombre: string
    servicios: {
      id: string
      nombre: string
      tipo: string
      precio_base: number | null
      activo: boolean
      fecha_inicio: string | null
      fecha_fin: string | null
      notas: string | null
      departamento: { id: string; nombre: string } | null
      responsable: { id: string; nombre: string } | null
      facturadoAnio: number
    }[]
  }
  const clienteMap = new Map<string, ClienteGroup>()

  for (const s of servicios ?? []) {
    const cli = (Array.isArray(s.cliente) ? s.cliente[0] : s.cliente) as { id: string; nombre: string } | null
    if (!cli) continue
    const dept = (Array.isArray(s.departamento) ? s.departamento[0] : s.departamento) as { id: string; nombre: string } | null
    const resp = (Array.isArray(s.responsable) ? s.responsable[0] : s.responsable) as { id: string; nombre: string } | null

    if (!clienteMap.has(cli.id)) {
      clienteMap.set(cli.id, { id: cli.id, nombre: cli.nombre, servicios: [] })
    }
    clienteMap.get(cli.id)!.servicios.push({
      id: s.id,
      nombre: s.nombre ?? '',
      tipo: s.tipo ?? 'recurrente',
      precio_base: s.precio_base ? Number(s.precio_base) : null,
      activo: s.activo ?? false,
      fecha_inicio: s.fecha_inicio ?? null,
      fecha_fin: s.fecha_fin ?? null,
      notas: s.notas ?? null,
      departamento: dept,
      responsable: resp,
      facturadoAnio: factByServicio.get(s.id) ?? 0,
    })
  }

  const clientes = [...clienteMap.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <TipoServicioDetailClient
      tipoServicio={tipoServicio}
      clientes={clientes}
      year={year}
    />
  )
}
