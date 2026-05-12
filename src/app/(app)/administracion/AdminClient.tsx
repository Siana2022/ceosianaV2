'use client'

import { useState, useMemo } from 'react'
import AlertasAdmin from '@/components/AlertasAdmin'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const formatEur = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)

const ESTADOS = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  facturado: { label: 'Facturado', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  cobrado: { label: 'Cobrado', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  incidencia: { label: 'Incidencia', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
} as const

type EstadoKey = keyof typeof ESTADOS

interface Ingreso {
  id_cliente: string
  cliente: string
  servicio: string
  departamento: string | null
  responsable: string | null
  valor: number
  mes: number
  anio: number
}

interface Control {
  id: string
  id_cliente: string
  mes: number
  anio: number
  estado: string
  notas: string | null
}

interface AlertaConfig {
  id: string
  tipo: string
  label: string
  descripcion: string | null
  activa: boolean
}

interface AdminUser {
  id: string
  email: string
}

interface Props {
  anio: number
  mesInicial: number
  ingresos: Ingreso[]
  controlExistente: Control[]
  isAdmin: boolean
  currentEmail: string
  alertasConfig: AlertaConfig[]
  adminsList: AdminUser[]
}

export default function AdminClient({ anio, mesInicial, ingresos, controlExistente, isAdmin, currentEmail, alertasConfig, adminsList }: Props) {
  const [mes, setMes] = useState(mesInicial)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [clienteExpandido, setClienteExpandido] = useState<string | null>(null)
  const [editandoNota, setEditandoNota] = useState<string | null>(null)
  const [guardandoNota, setGuardandoNota] = useState<string | null>(null)
  const [notaTexto, setNotaTexto] = useState('')

  // Local state for control records (id_cliente -> estado/notas)
  const [controlMap, setControlMap] = useState<Record<string, { estado: string; notas: string | null }>>(() => {
    const map: Record<string, { estado: string; notas: string | null }> = {}
    for (const c of controlExistente) {
      map[`${c.id_cliente}_${c.mes}_${c.anio}`] = { estado: c.estado, notas: c.notas }
    }
    return map
  })

  // Group ingresos by client for the selected month
  const clientesAgrupados = useMemo(() => {
    const ingresosMes = ingresos.filter(i => i.mes === mes)
    const map: Record<
      string,
      {
        id_cliente: string
        cliente: string
        servicios: { servicio: string; departamento: string | null; responsable: string | null; valor: number }[]
        total: number
      }
    > = {}

    for (const i of ingresosMes) {
      if (!map[i.id_cliente]) {
        map[i.id_cliente] = { id_cliente: i.id_cliente, cliente: i.cliente, servicios: [], total: 0 }
      }
      const existente = map[i.id_cliente].servicios.find(s => s.servicio === i.servicio)
      if (existente) {
        existente.valor += i.valor
      } else {
        map[i.id_cliente].servicios.push({
          servicio: i.servicio,
          departamento: i.departamento,
          responsable: i.responsable,
          valor: i.valor,
        })
      }
      map[i.id_cliente].total += i.valor
    }

    return Object.values(map).sort((a, b) => a.cliente.localeCompare(b.cliente))
  }, [ingresos, mes])

  const clientesFiltrados = useMemo(() => {
    if (!filtroEstado) return clientesAgrupados
    return clientesAgrupados.filter(c => {
      const key = `${c.id_cliente}_${mes}_${anio}`
      const estado = controlMap[key]?.estado ?? 'pendiente'
      return estado === filtroEstado
    })
  }, [clientesAgrupados, filtroEstado, controlMap, mes, anio])

  const resumen = useMemo(() => {
    const r = {
      pendiente: 0, facturado: 0, cobrado: 0, incidencia: 0,
      totalPendiente: 0, totalFacturado: 0, totalCobrado: 0,
    }
    for (const c of clientesAgrupados) {
      const key = `${c.id_cliente}_${mes}_${anio}`
      const estado = (controlMap[key]?.estado ?? 'pendiente') as EstadoKey
      if (estado === 'pendiente') { r.pendiente++; r.totalPendiente += c.total }
      if (estado === 'facturado') { r.facturado++; r.totalFacturado += c.total }
      if (estado === 'cobrado') { r.cobrado++; r.totalCobrado += c.total }
      if (estado === 'incidencia') r.incidencia++
    }
    return r
  }, [clientesAgrupados, mes, anio, controlMap])

  const handleCambiarEstado = async (id_cliente: string, nuevoEstado: string) => {
    const key = `${id_cliente}_${mes}_${anio}`
    const notasActuales = controlMap[key]?.notas ?? null
    setControlMap(prev => ({ ...prev, [key]: { estado: nuevoEstado, notas: notasActuales } }))
    await fetch('/api/administracion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_cliente, mes, anio, estado: nuevoEstado, notas: notasActuales }),
    })
  }

  const handleAbrirNota = (id_cliente: string) => {
    const key = `${id_cliente}_${mes}_${anio}`
    setNotaTexto(controlMap[key]?.notas ?? '')
    setEditandoNota(id_cliente)
  }

  const handleGuardarNota = async (id_cliente: string) => {
    const key = `${id_cliente}_${mes}_${anio}`
    const estadoActual = controlMap[key]?.estado ?? 'pendiente'
    setGuardandoNota(id_cliente)
    setControlMap(prev => ({ ...prev, [key]: { estado: estadoActual, notas: notaTexto } }))
    await fetch('/api/administracion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_cliente, mes, anio, estado: estadoActual, notas: notaTexto }),
    })
    setGuardandoNota(null)
    setEditandoNota(null)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Administración</h1>

      {/* Month selector */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {MESES.map((m, i) => (
          <button
            key={i}
            onClick={() => {
              setMes(i + 1)
              setClienteExpandido(null)
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              mes === i + 1
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {m}
          </button>
        ))}
        <span className="ml-auto text-gray-500 text-xs self-center">{anio}</span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Pendiente de facturar',
            count: resumen.pendiente,
            total: resumen.totalPendiente,
            color: 'text-yellow-400',
            key: 'pendiente',
          },
          {
            label: 'Facturado (por cobrar)',
            count: resumen.facturado,
            total: resumen.totalFacturado,
            color: 'text-orange-400',
            key: 'facturado',
          },
          {
            label: 'Cobrado',
            count: resumen.cobrado,
            total: resumen.totalCobrado,
            color: 'text-green-400',
            key: 'cobrado',
          },
          { label: 'Incidencias', count: resumen.incidencia, total: 0, color: 'text-red-400', key: 'incidencia' },
        ].map((k, i) => (
          <div
            key={i}
            className={`bg-gray-900 border rounded-xl p-4 cursor-pointer transition-colors ${
              filtroEstado === k.key
                ? 'border-blue-500'
                : 'border-gray-800 hover:border-gray-700'
            }`}
            onClick={() => setFiltroEstado(filtroEstado === k.key ? '' : k.key)}
          >
            <p className="text-gray-400 text-xs mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>
              {k.count} cliente{k.count !== 1 ? 's' : ''}
            </p>
            {k.total > 0 && <p className="text-gray-500 text-xs mt-1">{formatEur(k.total)}</p>}
          </div>
        ))}
      </div>

      {filtroEstado && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-gray-400 text-sm">
            Filtrando:{' '}
            <span className="text-white font-medium">
              {ESTADOS[filtroEstado as EstadoKey]?.label}
            </span>
          </span>
          <button
            onClick={() => setFiltroEstado('')}
            className="text-gray-500 hover:text-white text-xs"
          >
            ✕ Quitar filtro
          </button>
        </div>
      )}

      {clientesFiltrados.length === 0 && (
        <div className="text-center py-12 text-gray-600">
          <p className="text-3xl mb-3">📭</p>
          <p className="text-gray-500">No hay ingresos registrados para {MESES[mes - 1]} {anio}</p>
        </div>
      )}

      {/* Client rows */}
      <div className="space-y-2">
        {clientesFiltrados.map(c => {
          const key = `${c.id_cliente}_${mes}_${anio}`
          const estadoCliente = (controlMap[key]?.estado ?? 'pendiente') as EstadoKey
          const notaCliente = controlMap[key]?.notas
          const expandido = clienteExpandido === c.id_cliente

          return (
            <div
              key={c.id_cliente}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-800/30"
                onClick={() => setClienteExpandido(expandido ? null : c.id_cliente)}
              >
                <span className="text-gray-500 text-sm">{expandido ? '▼' : '▶'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold">{c.cliente}</p>
                  {notaCliente && (
                    <p className="text-yellow-400/70 text-xs mt-0.5 truncate">
                      📝 {notaCliente}
                    </p>
                  )}
                  <p className="text-gray-500 text-xs mt-0.5">
                    {c.servicios.length} servicio{c.servicios.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <p className="text-white font-bold text-lg">{formatEur(c.total)}</p>
                {/* Estado buttons */}
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  {(Object.entries(ESTADOS) as [EstadoKey, (typeof ESTADOS)[EstadoKey]][]).map(
                    ([k, v]) => (
                      <button
                        key={k}
                        onClick={() => handleCambiarEstado(c.id_cliente, k)}
                        className={`px-2 py-1 text-xs font-medium rounded-lg border transition-colors ${
                          estadoCliente === k
                            ? v.color
                            : 'bg-transparent border-gray-700 text-gray-500 hover:text-white'
                        }`}
                      >
                        {v.label}
                      </button>
                    )
                  )}
                </div>
              </div>

              {expandido && (
                <div className="border-t border-gray-800 bg-gray-800/20">
                  {/* Services table */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left text-gray-400 font-medium py-2 px-6">Servicio</th>
                        <th className="text-left text-gray-400 font-medium py-2 px-4">Departamento</th>
                        <th className="text-left text-gray-400 font-medium py-2 px-4">Responsable</th>
                        <th className="text-right text-gray-400 font-medium py-2 px-6">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.servicios.map((s, i) => (
                        <tr key={i} className="border-b border-gray-800/50">
                          <td className="text-white py-2 px-6">{s.servicio}</td>
                          <td className="text-gray-400 py-2 px-4">{s.departamento ?? '—'}</td>
                          <td className="text-gray-400 py-2 px-4">{s.responsable ?? '—'}</td>
                          <td className="text-right text-gray-300 py-2 px-6">{formatEur(s.valor)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-700">
                        <td colSpan={3} className="text-white font-bold py-2 px-6">
                          TOTAL
                        </td>
                        <td className="text-right text-blue-400 font-bold py-2 px-6">
                          {formatEur(c.total)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Notes section */}
                  <div className="px-6 py-4 border-t border-gray-800/50">
                    {editandoNota === c.id_cliente ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={notaTexto}
                          onChange={e => setNotaTexto(e.target.value)}
                          placeholder="Nota para este cliente en este mes..."
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleGuardarNota(c.id_cliente)
                            if (e.key === 'Escape') setEditandoNota(null)
                          }}
                        />
                        <button
                          onClick={() => handleGuardarNota(c.id_cliente)}
                          disabled={guardandoNota === c.id_cliente}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          {guardandoNota === c.id_cliente ? '...' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => setEditandoNota(null)}
                          className="text-gray-500 hover:text-white text-sm px-3 py-2 rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAbrirNota(c.id_cliente)}
                        className="text-gray-500 hover:text-blue-400 text-xs transition-colors flex items-center gap-1"
                      >
                        <span>📝</span>
                        <span>{notaCliente ? `Nota: ${notaCliente}` : 'Añadir nota...'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Alertas — solo admins */}
      {isAdmin && (
        <div className="mt-10">
          <h2 className="text-xl font-bold text-white mb-4">Sistema de alertas</h2>
          <AlertasAdmin
            alertasConfig={alertasConfig}
            admins={adminsList}
            currentEmail={currentEmail}
          />
        </div>
      )}
    </div>
  )
}
