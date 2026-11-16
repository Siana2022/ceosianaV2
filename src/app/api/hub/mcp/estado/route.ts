import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { listarHerramientas } from '@/lib/server/mcpGoogle'

// GET /api/hub/mcp/estado — diagnóstico de la conexión con Google Ads.
// Lista las herramientas que expone el servidor MCP para comprobar nombres.
export async function GET() {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: con } = await admin
    .from('mcp_conexiones')
    .select('proveedor, access_token, expires_at, updated_at')
    .eq('proveedor', 'google_ads')
    .maybeSingle()

  if (!con?.access_token) {
    return NextResponse.json({ conectado: false })
  }

  try {
    const herramientas = await listarHerramientas(con.access_token as string)
    return NextResponse.json({
      conectado: true,
      actualizado: con.updated_at,
      herramientas,
    })
  } catch (e) {
    return NextResponse.json({
      conectado: true,
      error: e instanceof Error ? e.message : 'Error desconocido',
    })
  }
}
