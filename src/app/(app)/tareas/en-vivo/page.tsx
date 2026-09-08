import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'
import { redirect } from 'next/navigation'
import EnVivoClient from './EnVivoClient'

export default async function EnVivoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') redirect('/tareas/vista-global')

  return <EnVivoClient />
}
