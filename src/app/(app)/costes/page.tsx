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
  const mes = parseInt(mesParam ?? String(now.getMonth() + 1))

  const supabase = await createClient()

  const [
    { data: gastos },
    { data: sueldosRaw },
    { data: empleados },
    { data: departamentos },
  ] = await Promise.all([
    supabase
      .from('gastos_fijos')
      .select('*, departamento:id_departamento(id,nombre)')
      .eq('mes', mes)
      .eq('anio', anio)
      .order('concepto'),
    supabase
      .from('sueldos')
      .select('id, id_empleado, coste_total, mes, anio')
      .eq('mes', mes)
      .eq('anio', anio),
    supabase.from('empleados').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('departamentos').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  // Merge sueldos with empleados names
  const sueldosByEmpleado = new Map((sueldosRaw ?? []).map(s => [s.id_empleado, s]))

  const sueldos = (empleados ?? []).map(emp => {
    const s = sueldosByEmpleado.get(emp.id)
    return {
      id: s?.id ?? null,
      id_empleado: emp.id,
      nombre: emp.nombre,
      coste_total: s?.coste_total ?? null,
      mes,
      anio,
    }
  })

  return (
    <CostesClient
      gastos={gastos ?? []}
      sueldos={sueldos}
      departamentos={departamentos ?? []}
      mes={mes}
      anio={anio}
    />
  )
}
