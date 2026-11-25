import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { llamarConTokenGuardado } from '@/lib/server/mcpGoogle'

interface CuentaDisponible {
  id: string
  nombre: string
  moneda: string
}

// GET /api/hub/cuentas/disponibles?plataforma=google_ads|meta_ads — cuentas accesibles con la
// conexión guardada, para poder vincularlas a los servicios del cliente.
export async function GET(req: Request) {
  const perfil = await getPerfil()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const plataforma = new URL(req.url).searchParams.get('plataforma') ?? 'google_ads'

  // Cuentas de Meta
  if (plataforma === 'meta_ads') {
    if (!process.env.META_SYSTEM_USER_TOKEN) {
      return NextResponse.json({ cuentas: [], motivo: 'Falta META_SYSTEM_USER_TOKEN' })
    }
    try {
      const { cuentasAnuncios } = await import('@/lib/server/meta')
      const r = await cuentasAnuncios(200)
      return NextResponse.json({
        cuentas: r.ad_accounts
          .filter(c => c.ad_account_id)
          .map(c => ({ id: `act_${c.ad_account_id}`, nombre: c.ad_account_name, moneda: c.currency })),
      })
    } catch (e) {
      return NextResponse.json({ cuentas: [], motivo: e instanceof Error ? e.message : 'Error de Meta' })
    }
  }

  const admin = createAdminClient()
  const { data: con } = await admin
    .from('mcp_conexiones')
    .select('access_token')
    .eq('proveedor', 'google_ads')
    .maybeSingle()

  if (!con?.access_token) {
    return NextResponse.json({ cuentas: [], motivo: 'Google Ads no está conectado' })
  }


  try {
    const raicesTexto = await llamarConTokenGuardado('customers_list_accessible_customers', {})
    const raices = (JSON.parse(raicesTexto) as unknown[])
      .map(x => String(x).replace(/\D/g, ''))
      .filter(Boolean)

    const cuentas: CuentaDisponible[] = []
    const vistos = new Set<string>()

    for (const raiz of raices) {
      try {
        const texto = await llamarConTokenGuardado('search_search', {
          customer_id: raiz,
          resource: 'customer_client',
          fields: [
            'customer_client.id',
            'customer_client.descriptive_name',
            'customer_client.currency_code',
            'customer_client.manager',
          ],
          conditions: ["customer_client.status = 'ENABLED'", 'customer_client.manager = FALSE'],
          orderings: ['customer_client.descriptive_name ASC'],
          login_customer_id: raiz,
        })

        const filas = JSON.parse(texto) as Record<string, unknown>[]
        for (const f of filas) {
          const id = String(f['customer_client.id'] ?? '')
          if (!id || vistos.has(id)) continue
          vistos.add(id)
          cuentas.push({
            id,
            nombre: String(f['customer_client.descriptive_name'] ?? id),
            moneda: String(f['customer_client.currency_code'] ?? 'EUR'),
          })
        }
      } catch {
        // una raíz que falla no debe tumbar el resto
      }
    }

    cuentas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    return NextResponse.json({ cuentas })
  } catch (e) {
    return NextResponse.json(
      { cuentas: [], error: e instanceof Error ? e.message : 'Error al consultar Google Ads' },
      { status: 502 },
    )
  }
}
