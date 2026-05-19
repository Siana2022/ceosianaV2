import { createClient } from '@/lib/server/supabase'
import CostesClient from './CostesClient'

export default async function CostesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; anio?: string }>
}) {
  const { mes: mesParam, anio: anioParam } = await searchParams
  const now = new Date()
  const anio = parseInt(anioParam ?? String(now.getFullYear()))
  const mes = mesParam ? parseInt(mesParam) : null
  const vistaAnual = mes === null

  const supabase = await createClient()

  const gastosQuery = vistaAnual
    ? supabase.from('gastos_fijos').select('*, departamento:id_departamento(id,nombre), cliente:id_cliente(id,nombre)').eq('anio', anio).order('concepto')
    : supabase.from('gastos_fijos').select('*, departamento:id_departamento(id,nombre), cliente:id_cliente(id,nombre)').eq('mes', mes!).eq('anio', anio).order('concepto')

  // Include ALL employees with salary records that year (active OR inactive)
  const sueldosQuery = vistaAnual
    ? supabase.from('sueldos').select('id, id_empleado, coste_total, mes, anio, empleado:id_empleado(id, nombre)').eq('anio', anio)
    : supabase.from('sueldos').select('id, id_empleado, coste_total, mes, anio, empleado:id_empleado(id, nombre)').eq('mes', mes!).eq('anio', anio)

  const [
    { data: gastos },
    { data: sueldosRaw },
    { data: departamentos },
    { data: clientes },
  ] = await Promise.all([
    gastosQuery,
    sueldosQuery,
    supabase.from('departamentos').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  // Build employee list from whoever has salary records this year (active or inactive)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const empleadosMap = new Map<string, string>()
  for (const s of sueldosRaw ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emp = (s as any).empleado
    const nombre = Array.isArray(emp) ? emp[0]?.nombre : emp?.nombre
    if (s.id_empleado && nombre) empleadosMap.set(s.id_empleado, nombre)
  }
  const empleados = Array.from(empleadosMap.entries())
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  // Merge sueldos with empleados names
  const sueldos = vistaAnual
    ? (() => {
        // Annual: 12 rows per employee (one per month), including nulls
        const byKey = new Map((sueldosRaw ?? []).map(s => [`${s.id_empleado}_${s.mes}`, s]))
        return empleados.flatMap(emp =>
          Array.from({ length: 12 }, (_, i) => {
            const m = i + 1
            const s = byKey.get(`${emp.id}_${m}`)
            return { id: s?.id ?? null, id_empleado: emp.id, nombre: emp.nombre, coste_total: s?.coste_total ?? null, mes: m, anio }
          })
        )
      })()
    : (() => {
        const byEmp = new Map((sueldosRaw ?? []).map(s => [s.id_empleado, s]))
        return empleados.map(emp => {
          const s = byEmp.get(emp.id)
          return { id: s?.id ?? null, id_empleado: emp.id, nombre: emp.nombre, coste_total: s?.coste_total ?? null, mes: mes!, anio }
        })
      })()

  return (
    <CostesClient
      gastos={gastos ?? []}
      sueldos={sueldos}
      departamentos={departamentos ?? []}
      clientes={clientes ?? []}
      mes={mes}
      anio={anio}
      vistaAnual={vistaAnual}
    />
  )
}
