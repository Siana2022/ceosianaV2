import { createClient } from '@/lib/server/supabase'
import HistoricoClient from './HistoricoClient'

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  const { cliente: clienteId } = await searchParams
  const supabase = await createClient()

  // Fetch all active clients for the selector
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  let datosPorAno: {
    ano: number
    facturacion: number
    coste: number
    margen: number
    margen_pct: number
  }[] = []

  let clienteSeleccionado = null

  if (clienteId && clientes) {
    clienteSeleccionado = clientes.find(c => c.id === clienteId) ?? null

    if (clienteSeleccionado) {
      // Fetch all ingresos for this client across all years
      const { data: ingresos } = await supabase
        .from('ingresos')
        .select('valor, anio')
        .eq('id_cliente', clienteId)

      // Fetch all costs attributed to this client across all years
      const { data: gastos } = await supabase
        .from('gastos_fijos')
        .select('valor, anio')
        .eq('id_cliente', clienteId)

      // Group by year
      const byYear: Record<number, { facturacion: number; coste: number }> = {}

      for (const i of ingresos ?? []) {
        if (!byYear[i.anio]) byYear[i.anio] = { facturacion: 0, coste: 0 }
        byYear[i.anio].facturacion += Number(i.valor ?? 0)
      }

      for (const g of gastos ?? []) {
        if (!byYear[g.anio]) byYear[g.anio] = { facturacion: 0, coste: 0 }
        byYear[g.anio].coste += Number(g.valor ?? 0)
      }

      datosPorAno = Object.entries(byYear)
        .map(([ano, data]) => {
          const margen = data.facturacion - data.coste
          const margen_pct = data.facturacion > 0 ? (margen / data.facturacion) * 100 : 0
          return { ano: parseInt(ano), ...data, margen, margen_pct }
        })
        .sort((a, b) => a.ano - b.ano)
    }
  }

  return (
    <HistoricoClient
      clientes={clientes ?? []}
      datosPorAno={datosPorAno}
      clienteSeleccionado={clienteSeleccionado}
    />
  )
}
