import { notFound } from 'next/navigation'
import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import InformesClient, { type Informe } from './InformesClient'

export default async function InformesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const perfil = await getPerfil()

  const { data: cliente } = await supabase.from('clientes').select('id, nombre').eq('id', id).maybeSingle()
  if (!cliente) notFound()

  const admin = createAdminClient()
  const { data: informes } = await admin
    .from('informes')
    .select('id, nombre, descripcion, tipo, config, publico, orden')
    .eq('id_cliente', id)
    .order('orden')

  return (
    <div className="p-8 w-full space-y-6">
      <div>
        <p className="text-[#6f6a62] text-xs mb-1">Informes</p>
        <h2 className="text-[30px] font-bold text-[#111] leading-tight">{cliente.nombre}</h2>
        <p className="text-[#6f6a62] text-sm mt-1">Dashboards de campañas y rendimiento</p>
      </div>

      <InformesClient
        idCliente={String(cliente.id)}
        informes={(informes ?? []) as Informe[]}
        esAdmin={perfil?.rol === 'admin'}
      />
    </div>
  )
}
