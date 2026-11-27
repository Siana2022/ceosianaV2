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
    { data: clientes },
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
    supabase.from('clientes').select('id, nombre, activo').order('nombre'),
  ])

  // Años disponibles: los que tienen captaciones, más el actual
  const aniosSet = new Set<number>([new Date().getFullYear()])
  for (const c of captaciones ?? []) {
    const y = parseInt(String(c.fecha_inicio ?? '').slice(0, 4))
    if (y) aniosSet.add(y)
  }
  aniosSet.add(anio)
  const anios = [...aniosSet].sort((a, b) => b - a)

  // Clientes sin ninguna captación registrada
  const conCaptacion = new Set((captaciones ?? []).map(c => c.id_cliente))
  const sinAsignar = (clientes ?? [])
    .filter(c => c.activo !== false && !conCaptacion.has(c.id))
    .map(c => ({ id: String(c.id), nombre: String(c.nombre) }))

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

  // Solo las captaciones del año elegido (aunque no tengan ingresos ese año)
  const captacionesAnio = (captaciones ?? []).filter(c => {
    const f = String(c.fecha_inicio ?? '')
    return f.startsWith(String(anio))
  })

  const sumar = (
    mapa: typeof revByCaptador,
    idEmpleado: string | null,
    rev: number,
  ) => {
    if (!idEmpleado) return
    const cur = mapa.get(idEmpleado)
    const emp = (empleados ?? []).find(e => e.id === idEmpleado)
    mapa.set(idEmpleado, {
      id: idEmpleado,
      nombre: emp?.nombre ?? idEmpleado,
      revenue: (cur?.revenue ?? 0) + rev,
      clientes: (cur?.clientes ?? 0) + 1,
    })
  }

  for (const c of captacionesAnio) {
    const rev = revByCliente.get(c.id_cliente) ?? 0
    sumar(revByCaptador, c.id_captador, rev)
    sumar(revByMantenedor, c.id_mantenedor, rev)
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
      sinAsignar={sinAsignar}
      anios={anios}
    />
  )
}
