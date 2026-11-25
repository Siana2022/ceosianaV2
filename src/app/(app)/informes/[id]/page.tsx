import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import InformesClient, { type Informe } from '@/components/informes/InformesClient'

export default async function InformeClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const perfil = await getPerfil()

  const admin = createAdminClient()
  const { data: cliente } = await admin.from('clientes').select('id, nombre').eq('id', id).maybeSingle()
  if (!cliente) notFound()

  const { data: informes } = await admin
    .from('informes')
    .select('id, nombre, descripcion, tipo, config, publico, orden')
    .eq('id_cliente', id)
    .order('orden')

  return (
    <div className="p-8 w-full space-y-6">
      <div>
        <Link href="/informes" className="text-[#6f6a62] text-xs hover:underline">← Informes</Link>
        <h2 className="text-[30px] font-bold text-[#111] leading-tight mt-1">{cliente.nombre}</h2>
        <p className="text-[#6f6a62] text-sm mt-1">Dashboards de campañas y rendimiento</p>
      </div>

      <InformesClient
        idCliente={String(cliente.id)}
        informes={(informes ?? []) as Informe[]}
        esAdmin={Boolean(perfil)}
      />
    </div>
  )
}
