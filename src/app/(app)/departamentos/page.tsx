import { createClient } from '@/lib/server/supabase'
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

export default async function DepartamentosPage() {
  const supabase = await createClient()
  const anio = new Date().getFullYear()

  const [
    { data: departamentosRaw },
    { data: miembros },
    { data: dedicacion },
    { data: ingresos },
    { data: sueldos },
    { data: gastosFijos },
    { data: serviciosRaw },
  ] = await Promise.all([
    supabase.from('departamentos').select('id, nombre, activo').order('nombre'),
    supabase
      .from('departamento_empleados')
      .select('id_departamento, id_empleado, empleado:id_empleado(id,nombre)'),
    supabase
      .from('empleado_dedicacion')
      .select('id_empleado, id_departamento, porcentaje, mes, anio')
      .eq('anio', anio),
    supabase
      .from('ingresos')
      .select('valor, mes, id_departamento')
      .eq('anio', anio)
      .not('id_departamento', 'is', null),
    supabase
      .from('sueldos')
      .select('id_empleado, coste_total, mes')
      .eq('anio', anio),
    supabase
      .from('gastos_fijos')
      .select('valor, id_departamento, tipo')
      .eq('anio', anio)
      .eq('tipo', 'departamento')
      .not('id_departamento', 'is', null),
    supabase
      .from('servicios')
      .select('id, id_departamento, activo')
      .not('id_departamento', 'is', null),
  ])

  // Build dedicacion maps
  const dedicacionMap = new Map<string, number>()
  const dedicacionCurrentMap = new Map<string, number>()
  const currentMes = new Date().getMonth() + 1
  for (const d of dedicacion ?? []) {
    dedicacionMap.set(`${d.id_empleado}_${d.id_departamento}_${d.mes}`, d.porcentaje)
    if (d.mes === currentMes) {
      dedicacionCurrentMap.set(`${d.id_empleado}_${d.id_departamento}`, d.porcentaje)
    }
  }

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

    // Calculate coste personal from empleado_dedicacion directly (consistent with detail page)
    let costePersonal = 0
    const deptDedicacion = (dedicacion ?? []).filter(d => d.id_departamento === dept.id)
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
    />
  )
}
