import { createClient } from './supabase'
import { createAdminClient } from './supabase-admin'

export interface Perfil {
  id: string
  id_empleado: string | null
  rol: 'admin' | 'empleado'
}

export async function getPerfil(): Promise<Perfil | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const { data } = await supabase
    .from('perfiles')
    .select('id, id_empleado, rol')
    .eq('id', session.user.id)
    .maybeSingle()

  if (data) return data

  // Auto-create perfil on first login, linking to empleado by email
  const admin = createAdminClient()
  const email = session.user.email ?? null
  let idEmpleado: string | null = null
  if (email) {
    const { data: emp } = await admin.from('empleados').select('id').eq('email', email).maybeSingle()
    idEmpleado = (emp as { id: string } | null)?.id ?? null
  }
  const { data: nuevo } = await admin
    .from('perfiles')
    .insert({ id: session.user.id, id_empleado: idEmpleado, rol: 'empleado' })
    .select('id, id_empleado, rol')
    .single()
  return nuevo ?? null
}

export async function isAdminPerfil(): Promise<boolean> {
  const perfil = await getPerfil()
  return perfil?.rol === 'admin'
}
