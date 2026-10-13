import { createAdminClient } from '@/lib/server/supabase-admin'
import BoardClient from './BoardClient'

export default async function EditorialBoardPage({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const admin = createAdminClient()

  const { data: cliente } = await admin
    .from('clientes')
    .select('id, nombre')
    .eq('id', clienteId)
    .maybeSingle()

  if (!cliente) {
    return (
      <div className="p-8">
        <p className="text-gray-400">Cliente no encontrado.</p>
      </div>
    )
  }

  return <BoardClient clienteId={clienteId} clienteNombre={cliente.nombre} />
}
