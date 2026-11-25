import { NextResponse } from 'next/server'
import { getPerfil } from '@/lib/server/perfil'
import { cuentasAnuncios, entidadesAnuncio } from '@/lib/server/meta'

// GET /api/hub/meta/estado — diagnóstico de la conexión con Meta Ads
export async function GET(req: Request) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  }

  if (!process.env.META_SYSTEM_USER_TOKEN) {
    return NextResponse.json({ conectado: false, motivo: 'Falta META_SYSTEM_USER_TOKEN' })
  }

  try {
    const r = await cuentasAnuncios(500)

    // Comprobación opcional de una cuenta concreta
    const cuenta = new URL(req.url).searchParams.get('cuenta')
    let pruebaCuenta: unknown = null
    if (cuenta) {
      try {
        const hoy = new Date().toISOString().slice(0, 10)
        const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
        const ads = await entidadesAnuncio({
          ad_account_id: cuenta,
          limit: 3,
          time_range: { since: hace30, until: hoy },
        })
        pruebaCuenta = { ok: true, anuncios: (ads.ad_entities ?? []).length }
      } catch (e2) {
        pruebaCuenta = { ok: false, error: e2 instanceof Error ? e2.message : 'Error' }
      }
    }

    return NextResponse.json({
      conectado: true,
      cuentas: r.ad_accounts.length,
      muestra: r.ad_accounts.slice(0, 5),
      pruebaCuenta,
    })
  } catch (e) {
    return NextResponse.json({
      conectado: true,
      error: e instanceof Error ? e.message : 'Error desconocido',
    })
  }
}
