import { NextResponse } from 'next/server'
import { getPerfil } from '@/lib/server/perfil'
import { cuentasAnuncios } from '@/lib/server/meta'

// GET /api/hub/meta/estado — diagnóstico de la conexión con Meta Ads
export async function GET() {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  }

  if (!process.env.META_SYSTEM_USER_TOKEN) {
    return NextResponse.json({ conectado: false, motivo: 'Falta META_SYSTEM_USER_TOKEN' })
  }

  try {
    const r = await cuentasAnuncios(10)
    return NextResponse.json({
      conectado: true,
      cuentas: r.ad_accounts.length,
      muestra: r.ad_accounts.slice(0, 5),
    })
  } catch (e) {
    return NextResponse.json({
      conectado: true,
      error: e instanceof Error ? e.message : 'Error desconocido',
    })
  }
}
