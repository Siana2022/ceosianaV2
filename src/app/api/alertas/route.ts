import { NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { isAdmin } from '@/lib/server/isAdmin'

export interface Alerta {
  tipo: string
  label: string
  severidad: 'alta' | 'media' | 'baja'
  items: { nombre: string; detalle?: string }[]
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = await createClient()
  const now = new Date()
  const year = now.getFullYear()
  const mes = now.getMonth() + 1

  // Fetch active alert types
  const { data: config } = await supabase
    .from('alertas_config')
    .select('tipo, activa')
  const activasSet = new Set((config ?? []).filter(c => c.activa).map(c => c.tipo))

  const alertas: Alerta[] = []

  // ── 1. CLIENTES CON MARGEN NEGATIVO ─────────────────────────────────────
  if (activasSet.has('margen_negativo')) {
    const [
      { data: clientes },
      { data: servicios },
      { data: ingresos },
      { data: gastosFijos },
      { data: responsables },
      { data: sueldos },
      { data: dedicaciones },
    ] = await Promise.all([
      supabase.from('clientes').select('id, nombre').eq('activo', true),
      supabase.from('servicios').select('id, id_cliente, id_departamento'),
      supabase.from('ingresos').select('valor, id_cliente').eq('anio', year).not('id_cliente', 'is', null),
      supabase.from('gastos_fijos').select('valor, id_cliente').eq('anio', year).not('id_cliente', 'is', null),
      supabase.from('servicio_responsables').select('id_servicio, id_empleado, mes').eq('anio', year),
      supabase.from('sueldos').select('id_empleado, coste_total, mes').eq('anio', year),
      supabase.from('empleado_dedicacion').select('id_empleado, id_departamento, mes, porcentaje').eq('anio', year),
    ])

    const servicioInfoMap = new Map<string, { id_cliente: string; id_departamento: string | null }>()
    for (const s of servicios ?? []) {
      if (!s.id_cliente) continue
      servicioInfoMap.set(s.id, { id_cliente: s.id_cliente, id_departamento: s.id_departamento ?? null })
    }
    const sueldoMap = new Map<string, number>()
    for (const s of sueldos ?? []) sueldoMap.set(`${s.id_empleado}_${s.mes}`, Number(s.coste_total))
    const dedicacionMap = new Map<string, number>()
    for (const d of dedicaciones ?? []) dedicacionMap.set(`${d.id_empleado}_${d.id_departamento}_${d.mes}`, Number(d.porcentaje))
    const numServiciosMap = new Map<string, number>()
    for (const r of responsables ?? []) {
      const info = servicioInfoMap.get(r.id_servicio)
      if (!info?.id_departamento) continue
      const key = `${r.id_empleado}_${info.id_departamento}_${r.mes}`
      numServiciosMap.set(key, (numServiciosMap.get(key) ?? 0) + 1)
    }
    const ingresosByCliente = new Map<string, number>()
    for (const i of ingresos ?? []) {
      if (!i.id_cliente) continue
      ingresosByCliente.set(i.id_cliente, (ingresosByCliente.get(i.id_cliente) ?? 0) + Number(i.valor))
    }
    const gastosByCliente = new Map<string, number>()
    for (const g of gastosFijos ?? []) {
      if (!g.id_cliente) continue
      gastosByCliente.set(g.id_cliente, (gastosByCliente.get(g.id_cliente) ?? 0) + Number(g.valor))
    }
    const costePersonalByCliente = new Map<string, number>()
    for (const r of responsables ?? []) {
      const info = servicioInfoMap.get(r.id_servicio)
      if (!info?.id_cliente || !info.id_departamento) continue
      const sueldo = sueldoMap.get(`${r.id_empleado}_${r.mes}`) ?? 0
      const dedicacion = dedicacionMap.get(`${r.id_empleado}_${info.id_departamento}_${r.mes}`) ?? 0
      const numServicios = numServiciosMap.get(`${r.id_empleado}_${info.id_departamento}_${r.mes}`) ?? 1
      costePersonalByCliente.set(info.id_cliente, (costePersonalByCliente.get(info.id_cliente) ?? 0) + sueldo * (dedicacion / 100) / numServicios)
    }

    const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
    const negativos = (clientes ?? []).filter(c => {
      const ing = ingresosByCliente.get(c.id) ?? 0
      if (ing === 0) return false
      const gas = gastosByCliente.get(c.id) ?? 0
      const per = costePersonalByCliente.get(c.id) ?? 0
      return ing - gas - per < 0
    }).map(c => {
      const ing = ingresosByCliente.get(c.id) ?? 0
      const gas = gastosByCliente.get(c.id) ?? 0
      const per = costePersonalByCliente.get(c.id) ?? 0
      const margen = ing - gas - per
      return { nombre: c.nombre, detalle: `Margen ${fmt(margen)} (${((margen / ing) * 100).toFixed(1)}%)` }
    })

    if (negativos.length > 0) {
      alertas.push({ tipo: 'margen_negativo', label: 'Clientes con margen negativo', severidad: 'alta', items: negativos })
    }
  }

  // ── 2. CLIENTES SIN INGRESOS ESTE MES ───────────────────────────────────
  if (activasSet.has('sin_ingresos_mes')) {
    const [{ data: clientesActivos }, { data: ingresosMes }] = await Promise.all([
      supabase.from('clientes').select('id, nombre').eq('activo', true),
      supabase.from('ingresos').select('id_cliente').eq('anio', year).eq('mes', mes).not('id_cliente', 'is', null),
    ])
    const conIngresos = new Set((ingresosMes ?? []).map(i => i.id_cliente))
    const sinIngresos = (clientesActivos ?? []).filter(c => !conIngresos.has(c.id))
    if (sinIngresos.length > 0) {
      alertas.push({
        tipo: 'sin_ingresos_mes',
        label: `Clientes sin ingresos en ${new Date(year, mes - 1).toLocaleString('es-ES', { month: 'long' })}`,
        severidad: 'media',
        items: sinIngresos.map(c => ({ nombre: c.nombre })),
      })
    }
  }

  // ── 3. SERVICIOS SIN RESPONSABLE ESTE MES ───────────────────────────────
  if (activasSet.has('sin_responsable')) {
    const [{ data: serviciosActivos }, { data: respMes }] = await Promise.all([
      supabase.from('servicios').select('id, nombre, cliente:id_cliente(nombre)').eq('activo', true),
      supabase.from('servicio_responsables').select('id_servicio').eq('anio', year).eq('mes', mes),
    ])
    const conResp = new Set((respMes ?? []).map(r => r.id_servicio))
    const sinResp = (serviciosActivos ?? []).filter(s => !conResp.has(s.id))
    if (sinResp.length > 0) {
      alertas.push({
        tipo: 'sin_responsable',
        label: 'Servicios sin responsable este mes',
        severidad: 'media',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: sinResp.map((s: any) => ({ nombre: s.nombre, detalle: s.cliente?.nombre ?? '' })),
      })
    }
  }

  // ── 4. EMPLEADOS SIN DEDICACIÓN ESTE MES ────────────────────────────────
  if (activasSet.has('sin_dedicacion')) {
    const [{ data: empleados }, { data: dedMes }] = await Promise.all([
      supabase.from('empleados').select('id, nombre').eq('activo', true),
      supabase.from('empleado_dedicacion').select('id_empleado').eq('anio', year).eq('mes', mes),
    ])
    const conDed = new Set((dedMes ?? []).map(d => d.id_empleado))
    const sinDed = (empleados ?? []).filter(e => !conDed.has(e.id))
    if (sinDed.length > 0) {
      alertas.push({
        tipo: 'sin_dedicacion',
        label: 'Empleados sin dedicación este mes',
        severidad: 'baja',
        items: sinDed.map(e => ({ nombre: e.nombre })),
      })
    }
  }

  // ── 5. CLIENTES INACTIVOS CON SERVICIOS ACTIVOS ──────────────────────────
  if (activasSet.has('cliente_inactivo_servicios')) {
    const { data: serviciosDeInactivos } = await supabase
      .from('servicios')
      .select('id, nombre, cliente:id_cliente(id, nombre, activo)')
      .eq('activo', true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conflictos = (serviciosDeInactivos ?? []).filter((s: any) => s.cliente && s.cliente.activo === false)
    if (conflictos.length > 0) {
      // Group by client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byCliente = new Map<string, { nombre: string; count: number }>()
      for (const s of conflictos as any[]) {
        const cId = s.cliente.id
        const cur = byCliente.get(cId) ?? { nombre: s.cliente.nombre, count: 0 }
        cur.count++
        byCliente.set(cId, cur)
      }
      alertas.push({
        tipo: 'cliente_inactivo_servicios',
        label: 'Clientes inactivos con servicios activos',
        severidad: 'baja',
        items: [...byCliente.values()].map(c => ({ nombre: c.nombre, detalle: `${c.count} servicio${c.count > 1 ? 's' : ''} activo${c.count > 1 ? 's' : ''}` })),
      })
    }
  }

  return NextResponse.json(alertas)
}
