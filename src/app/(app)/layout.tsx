import { redirect } from 'next/navigation'
import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const perfil = await getPerfil()
  const rol = perfil?.rol ?? 'admin' // default to admin if no profile (existing users)

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar rol={rol} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
