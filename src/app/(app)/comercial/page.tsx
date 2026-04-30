import { createClient } from '@/lib/server/supabase'
import ComercialClient from './ComercialClient'

export default async function ComercialPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>
}) {
  const { anio: anioParam } = await searchParams
  const anio = parseInt(anioParam ?? String(new Date().getFullYear()))

  const supabase = await createClient()

  const [
    { data: captaciones },
    { data: ingresos },
    { data: empleados },
  ] = await Promise.all([
    supabase
      .from('captacion_clientes')
      .select('*, captador:id_captador(id,nombre), mantenedor:id_mantenedor(id,nombre), cliente:id_cliente(id,nombre,activo)')
      .order('fecha_inicio', { ascending: false }),
    supabase
      .from('ingresos')
      .select('id, valor, id_cliente')
      .eq('anio', anio),
    supabase.from('empleados').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  // Build revenue map per client
  const revByCliente = new Map<string, number>()
  for (const i of ingresos ?? []) {
    if (!i.id_cliente) continue
    revByCliente.set(i.id_cliente, (revByCliente.get(i.id_cliente) ?? 0) + Number(i.valor))
  }

  // Build captacion map cliente -> captacion
  const captacionByCliente = new Map<string, { id_captador: string | null; id_mantenedor: string | null }>()
  for (const c of captaciones ?? []) {
    // Only use the most recent captacion per client
    if (!captacionByCliente.has(c.id_cliente)) {
      captacionByCliente.set(c.id_cliente, { id_captador: c.id_captador, id_mantenedor: c.id_mantenedor })
    }
  }

  // Revenue by captador
  const revByCaptador = new Map<string, { id: string; nombre: string; revenue: number; clientes: number }>()
  const revByMantenedor = new Map<string, { id: string; nombre: string; revenue: number; clientes: number }>()

  for (const [clienteId, rev] of revByCliente) {
    const cap = captacionByCliente.get(clienteId)
    if (!cap) continue
    if (cap.id_captador) {
      const cur = revByCaptador.get(cap.id_captador)
      const emp = (empleados ?? []).find(e => e.id === cap.id_captador)
      revByCaptador.set(cap.id_captador, {
        id: cap.id_captador,
        nombre: emp?.nombre ?? cap.id_captador,
        revenue: (cur?.revenue ?? 0) + rev,
        clientes: (cur?.clientes ?? 0) + 1,
      })
    }
    if (cap.id_mantenedor) {
      const cur = revByMantenedor.get(cap.id_mantenedor)
      const emp = (empleados ?? []).find(e => e.id === cap.id_mantenedor)
      revByMantenedor.set(cap.id_mantenedor, {
        id: cap.id_mantenedor,
        nombre: emp?.nombre ?? cap.id_mantenedor,
        revenue: (cur?.revenue ?? 0) + rev,
        clientes: (cur?.clientes ?? 0) + 1,
      })
    }
  }

  const resumenCaptador = [...revByCaptador.values()].sort((a, b) => b.revenue - a.revenue)
  const resumenMantenedor = [...revByMantenedor.values()].sort((a, b) => b.revenue - a.revenue)

  return (
    <ComercialClient
      captaciones={captaciones ?? []}
      empleados={empleados ?? []}
      resumenCaptador={resumenCaptador}
      resumenMantenedor={resumenMantenedor}
      anio={anio}
    />
  )
}
