import { createClient } from '@/lib/server/supabase'
import AdminClient from './AdminClient'

export default async function AdministracionPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; anio?: string }>
}) {
  const { mes: mesParam, anio: anioParam } = await searchParams
  const now = new Date()
  const anio = parseInt(anioParam ?? String(now.getFullYear()))
  const mes = parseInt(mesParam ?? String(now.getMonth() + 1))

  const supabase = await createClient()

  // Fetch all ingresos for the year with client and service info
  const { data: ingresosRaw } = await supabase
    .from('ingresos')
    .select(
      'id, valor, mes, anio, id_cliente, id_servicio, id_departamento, id_responsable, concepto, ' +
      'cliente:id_cliente(id,nombre), ' +
      'servicio:id_servicio(id,nombre), ' +
      'departamento:id_departamento(id,nombre), ' +
      'responsable:id_responsable(id,nombre)'
    )
    .eq('anio', anio)
    .gt('valor', 0)
    .order('mes')

  // Fetch existing control records for the year
  const { data: controlExistente } = await supabase
    .from('control_facturacion')
    .select('*')
    .eq('anio', anio)

  // Flatten ingresos with joined names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ingresos = (ingresosRaw ?? []).map((i: any) => {
    return {
      id_cliente: (i.cliente?.id ?? i.id_cliente) as string,
      cliente: (i.cliente?.nombre ?? 'Sin cliente') as string,
      servicio: (i.servicio?.nombre ?? i.concepto ?? 'Sin servicio') as string,
      departamento: (i.departamento?.nombre ?? null) as string | null,
      responsable: (i.responsable?.nombre ?? null) as string | null,
      valor: Number(i.valor ?? 0),
      mes: i.mes as number,
      anio: i.anio as number,
    }
  })

  return (
    <AdminClient
      anio={anio}
      mesInicial={mes}
      ingresos={ingresos}
      controlExistente={controlExistente ?? []}
    />
  )
}
