import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { redirect, notFound } from 'next/navigation'
import HubClient from './HubClient'
import type { HubServicio, HubCuenta, HubTarea, HubAccion } from './types'

export default async function HubPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ google?: string; msg?: string }>
}) {
  const { id } = await params
  const { google, msg } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const perfil = await getPerfil()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nombre, activo')
    .eq('id', id)
    .maybeSingle()

  if (!cliente) notFound()

  const { data: servicios } = await supabase
    .from('servicios')
    .select('id, nombre, activo, id_tipo_servicio, tipo_servicio:id_tipo_servicio(id, nombre)')
    .eq('id_cliente', id)
    .or('activo.eq.true,activo.is.null')
    .order('nombre')

  const ids = (servicios ?? []).map(s => s.id)

  // Tareas del cliente (id_cliente es text)
  const { data: tareas } = await supabase
    .from('tareas')
    .select('id, nombre, estado, fecha_limite, ids_responsables, id_servicio')
    .eq('id_cliente', id)
    .order('fecha_limite', { ascending: true })

  const { data: acciones } = ids.length
    ? await supabase
        .from('acciones')
        .select('id, id_servicio, fecha, tipo, titulo, minutos, empleado:id_empleado(nombre)')
        .in('id_servicio', ids)
        .order('fecha', { ascending: false })
        .limit(100)
    : { data: [] }

  const { data: cuentas } = ids.length
    ? await supabase
        .from('cuenta_plataforma')
        .select('id, id_servicio, plataforma, id_externo, nombre, moneda, activa, ultima_sync')
        .in('id_servicio', ids)
        .order('plataforma')
    : { data: [] }

  const admin = createAdminClient()
  const { data: conexion } = await admin
    .from('mcp_conexiones')
    .select('proveedor, updated_at')
    .eq('proveedor', 'google_ads')
    .maybeSingle()

  return (
    <HubClient
      googleConectado={Boolean(conexion)}
      avisoGoogle={google ? { tipo: google, detalle: msg ?? '' } : undefined}
      cliente={cliente as { id: string; nombre: string; activo: boolean | null }}
      servicios={(servicios ?? []) as unknown as HubServicio[]}
      cuentas={(cuentas ?? []) as unknown as HubCuenta[]}
      tareas={(tareas ?? []) as unknown as HubTarea[]}
      acciones={(acciones ?? []) as unknown as HubAccion[]}
      esAdmin={perfil?.rol === 'admin'}
      creativeLabUrl={process.env.CREATIVE_LAB_URL ?? ''}
    />
  )
}
