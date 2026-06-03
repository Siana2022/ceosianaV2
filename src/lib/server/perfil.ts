import { createClient } from './supabase'

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

  return data ?? null
}

export async function isAdminPerfil(): Promise<boolean> {
  const perfil = await getPerfil()
  return perfil?.rol === 'admin'
}
