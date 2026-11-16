import { createClient } from './supabase'
import { isAdminPerfil } from './perfil'

export async function getSessionEmail(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email ?? null
}

export async function isAdmin(): Promise<boolean> {
  return isAdminPerfil()
}
