import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import HubClient from '@/app/(app)/clientes/[id]/hub/HubClient'
import type { HubServicio, HubCuenta } from '@/app/(app)/clientes/[id]/hub/types'

export default async function HubIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  const { cliente: clienteId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const perfil = await getPerfil()

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre')
    .or('activo.eq.true,activo.is.null')
    .order('nombre')

  const lista = (clientes ?? []) as { id: string; nombre: string }[]

  // Sin cliente seleccionado → rejilla para elegir
  if (!clienteId) {
    return (
      <div className="p-6 max-w-6xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Hub</h2>
          <p className="text-gray-500 text-sm mt-0.5">Elige un cliente para abrir su espacio de trabajo</p>
        </div>

        {lista.length === 0 && <p className="text-gray-500 text-sm">No hay clientes activos.</p>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map(c => (
            <Link
              key={c.id}
              href={`/hub?cliente=${c.id}`}
              className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-colors"
            >
              <span className="text-white font-medium truncate">{c.nombre}</span>
              <span className="text-gray-500 text-xs flex-shrink-0">Abrir →</span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nombre, activo')
    .eq('id', clienteId)
    .maybeSingle()

  if (!cliente) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Cliente no encontrado.</p>
        <Link href="/hub" className="text-blue-400 hover:text-blue-300 text-sm">← Volver al hub</Link>
      </div>
    )
  }

  const { data: servicios } = await supabase
    .from('servicios')
    .select('id, nombre, activo, id_tipo_servicio, tipo_servicio:id_tipo_servicio(id, nombre)')
    .eq('id_cliente', clienteId)
    .or('activo.eq.true,activo.is.null')
    .order('nombre')

  const ids = (servicios ?? []).map(s => s.id)
  const { data: cuentas } = ids.length
    ? await supabase
        .from('cuenta_plataforma')
        .select('id, id_servicio, plataforma, id_externo, nombre, moneda, activa, ultima_sync')
        .in('id_servicio', ids)
        .order('plataforma')
    : { data: [] }

  return (
    <HubClient
      cliente={cliente as { id: string; nombre: string; activo: boolean | null }}
      servicios={(servicios ?? []) as unknown as HubServicio[]}
      cuentas={(cuentas ?? []) as unknown as HubCuenta[]}
      esAdmin={perfil?.rol === 'admin'}
      clientes={lista}
    />
  )
}
