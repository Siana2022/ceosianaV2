import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { CAMPOS, FUENTES, type FuenteDatos } from '@/lib/informes/campos'
import { listarCampos } from '@/lib/server/ga4'

// GET /api/informes/campos?id_cliente=... → catálogo de campos y disponibilidad
export async function GET(req: NextRequest) {
  const perfil = await getPerfil()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const idCliente = new URL(req.url).searchParams.get('id_cliente')

  const disponibles: Record<FuenteDatos, { conectada: boolean; motivo?: string }> = {
    google_ads: { conectada: false },
    meta_ads: { conectada: false },
    ga4: { conectada: false, motivo: 'Sin conectar' },
    shopify: { conectada: false, motivo: 'Sin conectar' },
  }

  // Google Ads: conexión guardada
  const admin = createAdminClient()
  const { data: con } = await admin.from('mcp_conexiones').select('access_token').eq('proveedor', 'google_ads').maybeSingle()
  disponibles.google_ads = con?.access_token
    ? { conectada: true }
    : { conectada: false, motivo: 'Conéctalo desde el hub del cliente' }

  // Meta: token del servidor
  disponibles.meta_ads = process.env.META_SYSTEM_USER_TOKEN
    ? { conectada: true }
    : { conectada: false, motivo: 'Falta el token de Meta' }

  // ¿El cliente tiene cuenta vinculada por plataforma?
  if (idCliente) {
    const { data: cli } = await admin.from('clientes').select('ga4_propiedad').eq('id', idCliente).maybeSingle()
    const propiedad = (cli as { ga4_propiedad?: string | null } | null)?.ga4_propiedad
    if (propiedad) disponibles.ga4 = { conectada: true }
    else disponibles.ga4 = { conectada: false, motivo: 'Vincula su propiedad en el hub' }
    const supabase = await createClient()
    const { data: servicios } = await supabase.from('servicios').select('id').eq('id_cliente', idCliente)
    const ids = (servicios ?? []).map(s => s.id)
    if (ids.length > 0) {
      const { data: cuentas } = await supabase
        .from('cuenta_plataforma')
        .select('plataforma')
        .in('id_servicio', ids)
        .eq('activa', true)
      const set = new Set((cuentas ?? []).map(c => String(c.plataforma)))
      if (!set.has('google_ads')) disponibles.google_ads = { conectada: false, motivo: 'Este cliente no tiene cuenta de Google Ads vinculada' }
      if (!set.has('meta_ads')) disponibles.meta_ads = { conectada: false, motivo: 'Este cliente no tiene cuenta de Meta vinculada' }
    }
  }

  // GA4: los campos reales de la propiedad del cliente
  let campos = CAMPOS.filter(c => c.fuente !== 'ga4')

  if (idCliente && disponibles.ga4.conectada) {
    const { data: cli } = await admin.from('clientes').select('ga4_propiedad').eq('id', idCliente).maybeSingle()
    const propiedad = (cli as { ga4_propiedad?: string | null } | null)?.ga4_propiedad
    if (propiedad) {
      try {
        const reales = await listarCampos(propiedad)
        campos = [
          ...campos,
          ...reales
            .filter(c => c.tipo === 'metrica')
            .map(c => ({
              variable: c.variable,
              etiqueta: c.etiqueta,
              tipo: 'metrica' as const,
              fuente: 'ga4' as const,
              descripcion: c.categoria,
            })),
        ]
      } catch (e) {
        console.error('[campos ga4]', e)
      }
    }
  }

  return NextResponse.json({
    fuentes: Object.entries(FUENTES).map(([id, nombre]) => ({
      id,
      nombre,
      ...disponibles[id as FuenteDatos],
    })),
    campos,
  })
}
