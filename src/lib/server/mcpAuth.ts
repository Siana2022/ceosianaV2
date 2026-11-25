import crypto from 'crypto'
import { createAdminClient } from './supabase-admin'

export type TipoLlave = 'operativo' | 'admin' | 'externo'

export interface LlaveMCP {
  tipo: TipoLlave
  nombre: string
  idEmpleado: string | null
  /** En llaves externas, limita el acceso a un único cliente. */
  idCliente: string | null
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
  let token = cabecera.toLowerCase().startsWith('bearer ') ? cabecera.slice(7).trim() : ''

  // Permite la llave en la URL (?llave=...) para clientes que no admiten
  // cabeceras. Es menos seguro: la URL puede quedar en registros.
  if (!token) {
    try {
      token = new URL(req.url).searchParams.get('llave')?.trim() ?? ''
    } catch {
      token = ''
    }
  }

  if (!token.startsWith('ceo_')) return null

  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const admin = createAdminClient()

  const { data } = await admin
    .from('mcp_llaves')
    .select('tipo, nombre, id_empleado, id_cliente, activo')
    .eq('hash', hash)
    .maybeSingle()

  if (!data || !data.activo) return null

  // Marca de uso (se espera: si no, en serverless no llega a guardarse)
  await admin.from('mcp_llaves').update({ ultimo_uso: new Date().toISOString() }).eq('hash', hash)

  return {
    tipo: data.tipo as TipoLlave,
    nombre: String(data.nombre),
    idEmpleado: (data.id_empleado as string | null) ?? null,
    idCliente: (data.id_cliente as string | null) ?? null,
  }
}
