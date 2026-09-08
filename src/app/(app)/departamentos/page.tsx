import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getDedicacionCalculada } from '@/lib/server/dedicacionCalculada'
import DepartamentosClient from './DepartamentosClient'

export interface DeptRentabilidad {
  id: string
  nombre: string
  ingresos: number
  costePersonal: number
  gastosPropios: number
  costTotal: number
  resultado: number
  margenPct: number
  num_proyectos: number
}

export default async function DepartamentosPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const sp = await searchParams
  const anio = Number(sp.anio) || new Date().getFullYear()
  const mesDesde = Math.min(12, Math.max(1, Number(sp.mesDesde) || 1))
  const mesHasta = Math.min(12, Math.max(mesDesde, Number(sp.mesHasta) || 12))

  const [
    { data: departamentosRaw },
    { data: miembros },
    dedicacion,
    { data: ingresos },
    { data: sueldos },
    { data: gastosFijos },
    { data: serviciosRaw },
  ] = await Promise.all([
    supabase.from('departamentos').select('id, nombre, activo').order('nombre'),
    supabase
      .from('departamento_empleados')
      .select('id_departamento, id_empleado, empleado:id_empleado(id,nombre)'),
    getDedicacionCalculada(createAdminClient(), { anio }),
    supabase
      .from('ingresos')
      .select('valor, mes, id_departamento')
      .eq('anio', anio)
      .gte('mes', mesDesde)
      .lte('mes', mesHasta)
      .not('id_departamento', 'is', null),
    createAdminClient()
      .from('sueldos')
      .select('id_empleado, coste_total, mes')
      .eq('anio', anio)
      .gte('mes', mesDesde)
      .lte('mes', mesHasta),
    supabase
      .from('gastos_fijos')
      .select('valor, id_departamento, tipo, mes')
      .eq('anio', anio)
      .eq('tipo', 'departamento')
      .not('id_departamento', 'is', null)
      .gte('mes', mesDesde)
      .lte('mes', mesHasta),
    supabase
      .from('servicios')
      .select('id, id_departamento, activo')
      .not('id_departamento', 'is', null),
  ])

  // Build dedicacion maps (filter to selected mes range)
  const dedicacionMap = new Map<string, number>()
  const dedicacionCurrentMap = new Map<string, number>()
  const currentMes = new Date().getMonth() + 1
  for (const d of dedicacion ?? []) {
    dedicacionMap.set(`${d.id_empleado}_${d.id_departamento}_${d.mes}`, d.porcentaje)
    if (d.mes === currentMes) {
      dedicacionCurrentMap.set(`${d.id_empleado}_${d.id_departamento}`, d.porcentaje)
    }
  }
  // Filter dedicacion to selected mes range
  const dedicacionFiltrada = (dedicacion ?? []).filter(d => d.mes >= mesDesde && d.mes <= mesHasta)

  // sueldo map: `${id_empleado}_${mes}` → coste_total
  const sueldoMap = new Map<string, number>()
  for (const s of sueldos ?? []) {
    sueldoMap.set(`${s.id_empleado}_${s.mes}`, Number(s.coste_total))
  }

  // num_proyectos per dept (active services)
  const numProyectosByDept = new Map<string, number>()
  for (const s of serviciosRaw ?? []) {
    if (!s.id_departamento || !s.activo) continue
    numProyectosByDept.set(s.id_departamento, (numProyectosByDept.get(s.id_departamento) ?? 0) + 1)
  }

  // Build miembrosMap for cards display: departamento_id → [{id, nombre, porcentaje}]
  const miembrosMap = new Map<string, { id: string; nombre: string; porcentaje: number }[]>()
  for (const m of miembros ?? []) {
    const empRaw = m.empleado
    const emp = (Array.isArray(empRaw) ? empRaw[0] : empRaw) as { id: string; nombre: string } | null
    if (!emp) continue
    if (!miembrosMap.has(m.id_departamento)) miembrosMap.set(m.id_departamento, [])
    const porcentaje = dedicacionCurrentMap.get(`${emp.id}_${m.id_departamento}`) ?? 0
    miembrosMap.get(m.id_departamento)!.push({ ...emp, porcentaje })
  }

  const departamentos = (departamentosRaw ?? []).map(d => ({
    ...d,
    miembros: miembrosMap.get(d.id) ?? [],
  }))

  // Compute per-department rentabilidad
  const rentabilidad: DeptRentabilidad[] = (departamentosRaw ?? []).map(dept => {
    const ingresosDept = (ingresos ?? [])
      .filter(r => r.id_departamento === dept.id)
      .reduce((s, r) => s + Number(r.valor), 0)

    // Calculate coste personal using filtered dedicacion
    let costePersonal = 0
    const deptDedicacion = dedicacionFiltrada.filter(d => d.id_departamento === dept.id)
    for (const d of deptDedicacion) {
      const sueldo = sueldoMap.get(`${d.id_empleado}_${d.mes}`) ?? 0
      costePersonal += sueldo * d.porcentaje / 100
    }

    const gastosPropios = (gastosFijos ?? [])
      .filter(g => g.id_departamento === dept.id)
      .reduce((s, g) => s + Number(g.valor), 0)

    const costTotal = costePersonal + gastosPropios
    const resultado = ingresosDept - costTotal
    const margenPct = ingresosDept > 0 ? (resultado / ingresosDept) * 100 : 0
    const num_proyectos = numProyectosByDept.get(dept.id) ?? 0

    return {
      id: dept.id,
      nombre: dept.nombre,
      ingresos: ingresosDept,
      costePersonal,
      gastosPropios,
      costTotal,
      resultado,
      margenPct,
      num_proyectos,
    }
  })

  return (
    <DepartamentosClient
      departamentos={departamentos}
      rentabilidad={rentabilidad}
      anio={anio}
      mesDesde={mesDesde}
      mesHasta={mesHasta}
    />
  )
}
