import Link from 'next/link'
import { createAdminClient } from '@/lib/server/supabase-admin'

export default async function InformesPage() {
  const admin = createAdminClient()

  const [{ data: clientes }, { data: informes }] = await Promise.all([
    admin.from('clientes').select('id, nombre, activo').order('nombre'),
    admin.from('informes').select('id_cliente, nombre'),
  ])

  const porCliente = new Map<string, string[]>()
  for (const i of informes ?? []) {
    const k = String((i as { id_cliente: string }).id_cliente)
    porCliente.set(k, [...(porCliente.get(k) ?? []), String((i as { nombre: string }).nombre)])
  }

  const lista = (clientes ?? []).filter(c => (c as { activo: boolean | null }).activo !== false)

  return (
    <div className="p-8 w-full space-y-6">
      <div>
        <h2 className="text-[30px] font-bold text-[#111] leading-tight">Informes</h2>
        <p className="text-[#6f6a62] text-sm mt-1">
          Dashboards de campañas y rendimiento por cliente
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {lista.map(c => {
          const cliente = c as { id: string; nombre: string }
          const mis = porCliente.get(String(cliente.id)) ?? []
          return (
            <Link
              key={cliente.id}
              href={`/informes/${cliente.id}`}
              className="bg-white border border-[#dcd7cd] rounded-xl p-5 hover:border-[#3B63FB] transition-colors"
            >
              <p className="text-[#111] font-semibold">{cliente.nombre}</p>
              <p className="text-[#6f6a62] text-xs mt-1">
                {mis.length > 0 ? `${mis.length} informe${mis.length > 1 ? 's' : ''}: ${mis.join(' · ')}` : 'Sin informes todavía'}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
