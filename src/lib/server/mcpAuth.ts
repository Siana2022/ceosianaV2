import crypto from 'crypto'
import { createAdminClient } from './supabase-admin'

export type TipoLlave = 'operativo' | 'admin'

export interface LlaveMCP {
  tipo: TipoLlave
  nombre: string
  idEmpleado: string | null
}

export function generarLlave(): { token: string; hash: string; prefijo: string } {
  const token = `ceo_${crypto.randomBytes(24).toString('hex')}`
  return {
    token,
    hash: crypto.createHash('sha256').update(token).digest('hex'),
    prefijo: token.slice(0, 12),
  }
}

/** Valida la cabecera Authorization contra la tabla de llaves. */
export async function verificarLlave(req: Request): Promise<LlaveMCP | null> {
  const cabecera = req.headers.get('authorization') ?? ''
  const token = cabecera.toLowerCase().startsWith('bearer ') ? cabecera.slice(7).trim() : ''
  if (!token.startsWith('ceo_')) return null

  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const admin = createAdminClient()

  const { data } = await admin
    .from('mcp_llaves')
    .select('tipo, nombre, id_empleado, activo')
    .eq('hash', hash)
    .maybeSingle()

  if (!data || !data.activo) return null

  // Marca de uso, sin bloquear la respuesta
  void admin.from('mcp_llaves').update({ ultimo_uso: new Date().toISOString() }).eq('hash', hash)

  return {
    tipo: data.tipo as TipoLlave,
    nombre: String(data.nombre),
    idEmpleado: (data.id_empleado as string | null) ?? null,
  }
}
