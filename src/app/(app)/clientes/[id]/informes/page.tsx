import { notFound } from 'next/navigation'
import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import InformesClient, { type Informe, type SerieMes } from './InformesClient'

export default async function InformesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ anio?: string }>
}) {
  const { id } = await params
  const { anio } = await searchParams
  const year = parseInt(anio ?? String(new Date().getFullYear()))

  const supabase = await createClient()
  const perfil = await getPerfil()

  const { data: cliente } = await supabase.from('clientes').select('id, nombre').eq('id', id).maybeSingle()
  if (!cliente) notFound()

  const admin = createAdminClient()
  const { data: servicios } = await supabase.from('servicios').select('id').eq('id_cliente', id)
  const idsServicio = (servicios ?? []).map(s => s.id)

  const [{ data: ingresos }, { data: logs }, { data: tareas }, { data: informes }] = await Promise.all([
    idsServicio.length
      ? supabase.from('ingresos').select('valor, mes').eq('anio', year).in('id_servicio', idsServicio)
      : Promise.resolve({ data: [] }),
    supabase.from('time_logs').select('minutos, fecha').eq('id_cliente', id).gte('fecha', `${year}-01-01`).lte('fecha', `${year}-12-31`),
    supabase.from('tareas').select('id, created_at').eq('id_cliente', id).gte('created_at', `${year}-01-01`).lte('created_at', `${year}-12-31T23:59:59`),
    admin.from('informes').select('id, nombre, descripcion, tipo, config, publico, orden').eq('id_cliente', id).order('orden'),
  ])

  // Serie mensual con los datos internos disponibles
  const serie: SerieMes[] = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, facturado: 0, horas: 0, tareas: 0 }))
  for (const ing of ingresos ?? []) {
    const m = Number((ing as { mes: number }).mes)
    if (m >= 1 && m <= 12) serie[m - 1].facturado += Number((ing as { valor: number }).valor)
  }
  for (const l of logs ?? []) {
    const m = parseInt(String((l as { fecha: string }).fecha).substring(5, 7))
    if (m >= 1 && m <= 12) serie[m - 1].horas += Number((l as { minutos: number }).minutos) / 60
  }
  for (const t of tareas ?? []) {
    const m = parseInt(String((t as { created_at: string }).created_at).substring(5, 7))
    if (m >= 1 && m <= 12) serie[m - 1].tareas += 1
  }

  return (
    <div className="p-8 w-full space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[#6f6a62] text-xs mb-1">Informes</p>
          <h2 className="text-[30px] font-bold text-[#111] leading-tight">{cliente.nombre}</h2>
          <p className="text-[#6f6a62] text-sm mt-1">Dashboards configurables del cliente · {year}</p>
        </div>
      </div>

      <InformesClient
        idCliente={String(cliente.id)}
        year={year}
        serie={serie}
        informes={(informes ?? []) as Informe[]}
        esAdmin={perfil?.rol === 'admin'}
      />
    </div>
  )
}
