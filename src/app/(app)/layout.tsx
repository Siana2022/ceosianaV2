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
  const rol = perfil?.rol ?? 'empleado'

  const { data: rawClientes } = rol === 'admin'
    ? await supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre')
    : { data: [] }

  const clientes = (rawClientes ?? []).map(c => ({ id: String(c.id), nombre: c.nombre as string }))

  return (
    <div className="flex min-h-screen bg-[#E4E2DC]">
      <Sidebar rol={rol} clientes={clientes} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
