import { NextResponse } from 'next/server'
import { getPerfil } from '@/lib/server/perfil'
import { listarPropiedades, tokenValido } from '@/lib/server/ga4'

// GET /api/hub/ga4/propiedades — propiedades de GA4 accesibles
export async function GET() {
  const perfil = await getPerfil()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const token = await tokenValido()
    if (!token) return NextResponse.json({ conectado: false, propiedades: [] })
    const propiedades = await listarPropiedades()
    return NextResponse.json({ conectado: true, propiedades })
  } catch (e) {
    return NextResponse.json({
      conectado: true,
      propiedades: [],
      error: e instanceof Error ? e.message : 'Error de Google Analytics',
    })
  }
}
