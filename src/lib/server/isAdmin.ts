import { createClient } from './supabase'

export async function getSessionEmail(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.email ?? null
}

export async function isAdmin(): Promise<boolean> {
  const email = await getSessionEmail()
  if (!email) return false
  const supabase = await createClient()
  const { data } = await supabase
    .from('alertas_admins')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  return !!data
}
