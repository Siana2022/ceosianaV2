'use client'

import { useEffect, useState } from 'react'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

const fmtDate = (d: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface ClienteDesactivado {
  id: string
  nombre: string
  fecha_alta: string | null
  fecha_baja: string | null
  notas: string | null
  num_servicios: number
  facturacionPorAnio: Record<number, number>
  totalHistorico: number
}

export default function DesactivadosClient() {
  const [clientes, setClientes] = useState<ClienteDesactivado[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/desactivados')
      .then(r => r.json())
      .then(data => {
        setClientes(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const yearsSet = new Set<number>()
  for (const c of clientes) {
    for (const y of Object.keys(c.facturacionPorAnio)) {
      yearsSet.add(parseInt(y))
    }
  }
  const years = Array.from(yearsSet).sort((a, b) => b - a)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Clientes Desactivados</h2>
          <p className="text-gray-400 text-sm mt-1">
            {loading ? 'Cargando...' : `${clientes.length} cliente${clientes.length !== 1 ? 's' : ''} inactivo${clientes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-12">Cargando clientes desactivados...</p>
      ) : clientes.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No hay clientes desactivados</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Cliente</th>
                <th className="text-center px-4 py-3 text-gray-400 font-medium">Servicios</th>
                {years.map(y => (
                  <th key={y} className="text-right px-4 py-3 text-gray-400 font-medium">
                    {y}
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Total histórico</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Fecha baja</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-white font-medium">{c.nombre}</span>
                    {c.fecha_alta && (
                      <span className="block text-xs text-gray-500 mt-0.5">
                        Alta: {fmtDate(c.fecha_alta)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">{c.num_servicios}</td>
                  {years.map(y => (
                    <td key={y} className="px-4 py-3 text-right text-gray-300">
                      {c.facturacionPorAnio[y] != null && c.facturacionPorAnio[y] > 0
                        ? fmt(c.facturacionPorAnio[y])
                        : <span className="text-gray-600">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-semibold text-white">
                    {c.totalHistorico > 0 ? fmt(c.totalHistorico) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{fmtDate(c.fecha_baja)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
