'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

interface ServicioCliente {
  id: string
  nombre: string
  tipo: string
  precio_base: number | null
  activo: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
  notas: string | null
  departamento: { id: string; nombre: string } | null
  responsable: { id: string; nombre: string } | null
  facturadoAnio: number
}

interface ClienteGroup {
  id: string
  nombre: string
  servicios: ServicioCliente[]
}

interface Props {
  tipoServicio: { id: string; nombre: string }
  clientes: ClienteGroup[]
  year: number
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 2022 }, (_, i) => CURRENT_YEAR - i)

export default function TipoServicioDetailClient({ tipoServicio, clientes, year }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const totalFacturado = clientes.reduce(
    (sum, c) => sum + c.servicios.reduce((s, sv) => s + sv.facturadoAnio, 0),
    0
  )
  const totalActivos = clientes.filter(c => c.servicios.some(s => s.activo)).length
  const totalServicios = clientes.reduce((sum, c) => sum + c.servicios.length, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/servicios" className="text-gray-500 hover:text-white text-sm transition-colors">
          ← Servicios
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-white text-xl font-semibold">{tipoServicio.nombre}</h1>
        <div className="ml-auto flex gap-2">
          {YEARS.map(y => (
            <button
              key={y}
              onClick={() => router.push(`/servicios/${tipoServicio.id}?year=${y}`)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                y === year ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wide">Clientes activos</p>
          <p className="text-white text-2xl font-bold mt-1">{totalActivos}</p>
          <p className="text-gray-600 text-xs mt-1">de {clientes.length} total</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wide">Servicios</p>
          <p className="text-white text-2xl font-bold mt-1">{totalServicios}</p>
          <p className="text-gray-600 text-xs mt-1">instancias en cartera</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wide">Facturado {year}</p>
          <p className="text-blue-400 text-2xl font-bold mt-1">{fmt(totalFacturado)}</p>
          <p className="text-gray-600 text-xs mt-1">total del tipo</p>
        </div>
      </div>

      {/* Clients list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Clientes con {tipoServicio.nombre}</h2>
        </div>

        {clientes.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">No hay clientes con este servicio</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {clientes.map(cliente => {
              const isOpen = expanded.has(cliente.id)
              const hasActivo = cliente.servicios.some(s => s.activo)
              const totalCliente = cliente.servicios.reduce((s, sv) => s + sv.facturadoAnio, 0)

              return (
                <div key={cliente.id}>
                  {/* Cliente row */}
                  <button
                    onClick={() => toggle(cliente.id)}
                    className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-800/40 transition-colors text-left"
                  >
                    <span className={`text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium">{cliente.nombre}</span>
                        {!hasActivo && (
                          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">Inactivo</span>
                        )}
                        <span className="text-gray-600 text-xs">{cliente.servicios.length} servicio{cliente.servicios.length > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0">
                      {totalCliente > 0 && (
                        <span className="text-blue-400 font-mono text-sm font-bold">{fmt(totalCliente)}</span>
                      )}
                      <Link
                        href={`/clientes/${cliente.id}`}
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-gray-500 hover:text-blue-400 transition-colors px-2 py-1 rounded hover:bg-gray-800"
                      >
                        Ver cliente →
                      </Link>
                    </div>
                  </button>

                  {/* Expanded services */}
                  {isOpen && (
                    <div className="bg-gray-950 border-t border-gray-800/50">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800/50">
                            <th className="text-left px-10 py-2">Servicio</th>
                            <th className="text-left px-4 py-2">Responsable</th>
                            <th className="text-left px-4 py-2">Departamento</th>
                            <th className="text-left px-4 py-2">Desde</th>
                            <th className="text-right px-4 py-2">Precio base</th>
                            <th className="text-right px-6 py-2">Facturado {year}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cliente.servicios.map(sv => (
                            <tr key={sv.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                              <td className="px-10 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sv.activo ? 'bg-green-500' : 'bg-gray-600'}`} />
                                  <span className="text-white">{sv.nombre || tipoServicio.nombre}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${sv.tipo === 'recurrente' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                    {sv.tipo === 'recurrente' ? 'MRR' : 'Puntual'}
                                  </span>
                                </div>
                                {sv.notas && <p className="text-gray-600 text-xs mt-0.5 pl-3.5 truncate max-w-xs">{sv.notas}</p>}
                              </td>
                              <td className="px-4 py-3 text-gray-400 text-xs">{sv.responsable?.nombre ?? '—'}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs">{sv.departamento?.nombre ?? '—'}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{sv.fecha_inicio ? sv.fecha_inicio.substring(0, 7) : '—'}</td>
                              <td className="px-4 py-3 text-right text-gray-300 text-xs">
                                {sv.precio_base ? fmt(sv.precio_base) : '—'}
                              </td>
                              <td className="px-6 py-3 text-right">
                                {sv.facturadoAnio > 0
                                  ? <span className="text-blue-400 font-mono text-xs font-bold">{fmt(sv.facturadoAnio)}</span>
                                  : <span className="text-gray-600 text-xs">—</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
