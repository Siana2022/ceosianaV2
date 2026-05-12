import { NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET() {
  const supabase = await createClient()

  const [{ data: clientes }, { data: ingresos }, { data: servicios }] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nombre, activo, fecha_alta, fecha_baja, notas')
      .or('activo.eq.false,activo.is.null')
      .order('nombre'),
    supabase
      .from('ingresos')
      .select('id_cliente, valor, anio'),
    supabase
      .from('servicios')
      .select('id, id_cliente'),
  ])

  const inactiveIds = new Set((clientes ?? []).map(c => c.id))

  const ingresosFiltered = (ingresos ?? []).filter(i => i.id_cliente && inactiveIds.has(i.id_cliente))

  const facturacionMap = new Map<string, Record<number, number>>()
  for (const ing of ingresosFiltered) {
    if (!ing.id_cliente) continue
    const perYear = facturacionMap.get(ing.id_cliente) ?? {}
    perYear[ing.anio] = (perYear[ing.anio] ?? 0) + Number(ing.valor ?? 0)
    facturacionMap.set(ing.id_cliente, perYear)
  }

  const serviciosFiltered = (servicios ?? []).filter(s => s.id_cliente && inactiveIds.has(s.id_cliente))
  const serviciosCountMap = new Map<string, number>()
  for (const s of serviciosFiltered) {
    if (!s.id_cliente) continue
    serviciosCountMap.set(s.id_cliente, (serviciosCountMap.get(s.id_cliente) ?? 0) + 1)
  }

  const enriched = (clientes ?? []).map(c => {
    const facturacionPorAnio = facturacionMap.get(c.id) ?? {}
    const totalHistorico = Object.values(facturacionPorAnio).reduce((sum, v) => sum + v, 0)
    return {
      id: c.id,
      nombre: c.nombre,
      fecha_alta: c.fecha_alta ?? null,
      fecha_baja: c.fecha_baja ?? null,
      notas: c.notas ?? null,
      num_servicios: serviciosCountMap.get(c.id) ?? 0,
      facturacionPorAnio,
      totalHistorico,
    }
  })

  return NextResponse.json(enriched)
}
