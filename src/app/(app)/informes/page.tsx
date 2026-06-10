import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'
import { redirect } from 'next/navigation'
import InformesClient from './InformesClient'

export default async function InformesPage() {
  const perfil = await getPerfil()
  if (!perfil || perfil.rol !== 'admin') redirect('/fichar')

  // Validate session exists
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  return <InformesClient />
}
