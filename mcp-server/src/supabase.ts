import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno')
}

// Service role: este servidor corre en un entorno de confianza (VPS o local),
// nunca en el navegador.
export const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export function texto(valor: unknown) {
  return {
    content: [{ type: 'text' as const, text: typeof valor === 'string' ? valor : JSON.stringify(valor, null, 2) }],
  }
}

/** Acepta id (uuid) o nombre aproximado y devuelve el cliente. */
export async function resolverCliente(entrada: string) {
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entrada)
  const q = db.from('clientes').select('id, nombre, activo')
  const { data } = esUuid ? await q.eq('id', entrada).maybeSingle() : await q.ilike('nombre', `%${entrada}%`).limit(1).maybeSingle()
  return data
}

/** Acepta id (uuid) o nombre aproximado y devuelve el servicio. */
export async function resolverServicio(entrada: string) {
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entrada)
  const q = db.from('servicios').select('id, nombre, id_cliente, activo')
  const { data } = esUuid ? await q.eq('id', entrada).maybeSingle() : await q.ilike('nombre', `%${entrada}%`).limit(1).maybeSingle()
  return data
}
