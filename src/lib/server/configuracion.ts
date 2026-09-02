import { createClient } from '@/lib/server/supabase'

export async function getConfiguracion(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase.from('configuracion').select('clave, valor')
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.clave] = row.valor
  return map
}
