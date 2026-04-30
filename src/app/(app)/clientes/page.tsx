import { createClient } from '@/lib/server/supabase'
import ClientesClient from './ClientesClient'

export default async function ClientesPage() {
  const supabase = await createClient()

  const [
    { data: clientes },
    { data: servicios },
    { data: captacion },
  ] = await Promise.all([
    supabase.from('clientes').select('*').order('nombre'),
    supabase.from('servicios').select('id, id_cliente, tipo, precio_base, activo'),
    supabase
      .from('captacion_clientes')
      .select('id_cliente, captador:id_captador(id,nombre), mantenedor:id_mantenedor(id,nombre)'),
  ])

  // Build a map of client_id -> mrr, num_servicios
  const serviciosByCliente = new Map<string, { mrr: number; count: number }>()
  for (const s of servicios ?? []) {
    if (!s.id_cliente) continue
    const cur = serviciosByCliente.get(s.id_cliente) ?? { mrr: 0, count: 0 }
    cur.count += 1
    if (s.activo && s.tipo === 'recurrente') {
      cur.mrr += Number(s.precio_base ?? 0)
    }
    serviciosByCliente.set(s.id_cliente, cur)
  }

  // Build captacion map (last entry wins)
  const captacionByCliente = new Map<string, { captador_nombre: string; mantenedor_nombre: string }>()
  for (const c of captacion ?? []) {
    captacionByCliente.set(c.id_cliente, {
      captador_nombre: (c.captador as unknown as { nombre: string } | null)?.nombre ?? '',
      mantenedor_nombre: (c.mantenedor as unknown as { nombre: string } | null)?.nombre ?? '',
    })
  }

  const enriched = (clientes ?? []).map(c => ({
    ...c,
    mrr: serviciosByCliente.get(c.id)?.mrr ?? 0,
    num_servicios: serviciosByCliente.get(c.id)?.count ?? 0,
    captador_nombre: captacionByCliente.get(c.id)?.captador_nombre ?? '',
    mantenedor_nombre: captacionByCliente.get(c.id)?.mantenedor_nombre ?? '',
  }))

  return <ClientesClient clientes={enriched} />
}
