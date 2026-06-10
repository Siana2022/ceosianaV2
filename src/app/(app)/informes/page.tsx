import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'
import { redirect } from 'next/navigation'
import InformesClient from './InformesClient'

export default async function InformesPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const perfilData = await getPerfil()
  // Same fallback as fichar/page.tsx — users without a perfiles row are treated as admin
  const perfil = perfilData ?? { id: '', id_empleado: null, rol: 'admin' as const }
  if (perfil.rol !== 'admin') redirect('/fichar')

  return <InformesClient />
}
