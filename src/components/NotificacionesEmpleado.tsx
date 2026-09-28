'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Notificacion {
  id: string
  tipo: string
  titulo: string
  mensaje: string | null
  id_tarea: string | null
  leida: boolean
  created_at: string
}

const TIPO_ICON: Record<string, string> = {
  tarea_asignada: '📋',
  tarea_bloqueada: '🔴',
  tarea_completada: '✅',
  mencion: '💬',
}

function formatFecha(iso: string) {
  const d = new Date(iso)
  const ahora = new Date()
  const diffMs = ahora.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'ahora mismo'
  if (diffMin < 60) return `hace ${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `hace ${diffD}d`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function NotificacionesEmpleado() {
  const [notifs, setNotifs] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifs()
  }, [])

  async function fetchNotifs() {
    setLoading(true)
    try {
      const res = await fetch('/api/notificaciones')
      const data = await res.json()
      setNotifs(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  async function marcarLeida(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    await fetch('/api/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
  }

  async function marcarTodasLeidas() {
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
    await fetch('/api/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
  }

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
        Cargando notificaciones...
      </div>
    )
  }

  const noLeidas = notifs.filter(n => !n.leida)
  const leidas = notifs.filter(n => n.leida)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-semibold">Mis notificaciones</h3>
          {noLeidas.length > 0 && (
            <span className="text-xs bg-blue-900/60 text-blue-400 border border-blue-700/50 rounded-full px-2 py-0.5">
              {noLeidas.length} nueva{noLeidas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {noLeidas.length > 0 && (
            <button
              onClick={marcarTodasLeidas}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Marcar todas como leídas
            </button>
          )}
          <button
            onClick={fetchNotifs}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            ↻
          </button>
        </div>
      </div>

      {notifs.length === 0 ? (
        <div className="px-6 py-10 text-center text-gray-500 text-sm">
          <p className="text-3xl mb-2">🔔</p>
          <p>Sin notificaciones por ahora</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800/50">
          {/* No leídas */}
          {noLeidas.map(n => (
            <div
              key={n.id}
              className="px-6 py-4 bg-blue-950/20 hover:bg-blue-950/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5 flex-shrink-0">{TIPO_ICON[n.tipo] ?? '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-white text-sm font-medium leading-tight">{n.titulo}</p>
                    <span className="text-gray-500 text-xs whitespace-nowrap flex-shrink-0">{formatFecha(n.created_at)}</span>
                  </div>
                  {n.mensaje && (
                    <p className="text-gray-400 text-xs mt-0.5">{n.mensaje}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {n.id_tarea && (
                      <Link
                        href={`/tareas/vista-global?tarea=${n.id_tarea}`}
                        onClick={() => marcarLeida(n.id)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Ver tarea →
                      </Link>
                    )}
                    <button
                      onClick={() => marcarLeida(n.id)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Marcar como leída
                    </button>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
              </div>
            </div>
          ))}

          {/* Leídas (colapsadas visualmente) */}
          {leidas.length > 0 && (
            <>
              {noLeidas.length > 0 && (
                <div className="px-6 py-2 bg-gray-900/60">
                  <span className="text-xs text-gray-600 uppercase tracking-wide font-medium">Anteriores</span>
                </div>
              )}
              {leidas.slice(0, 10).map(n => (
                <div key={n.id} className="px-6 py-3.5 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-base mt-0.5 flex-shrink-0 opacity-50">{TIPO_ICON[n.tipo] ?? '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-gray-400 text-sm leading-tight">{n.titulo}</p>
                        <span className="text-gray-600 text-xs whitespace-nowrap flex-shrink-0">{formatFecha(n.created_at)}</span>
                      </div>
                      {n.id_tarea && (
                        <Link
                          href={`/tareas/vista-global?tarea=${n.id_tarea}`}
                          className="text-xs text-gray-600 hover:text-gray-400 transition-colors mt-1 inline-block"
                        >
                          Ver tarea →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
