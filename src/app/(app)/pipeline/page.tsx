import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { redirect } from 'next/navigation'
import PipelineClient from './PipelineClient'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') redirect('/fichar')

  const admin = createAdminClient()

  const [{ data: prospectos }, { data: empleados }] = await Promise.all([
    admin
      .from('pipeline_prospectos')
      .select('*')
      .order('created_at', { ascending: false }),
    admin
      .from('empleados')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
  ])

  return (
    <PipelineClient
      initialProspectos={prospectos ?? []}
      empleados={(empleados ?? []).map(e => ({ id: String(e.id), nombre: e.nombre as string }))}
    />
  )
}
