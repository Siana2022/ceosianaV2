'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Notif {
  id: string
  tipo: string
  titulo: string
  mensaje: string | null
  id_tarea: string | null
  leida: boolean
  created_at: string
}

interface TareaHoy {
  id: string
  nombre: string
  tipo: string
  estado: string
  hora: string | null
  id_cliente: string | null
}

const TIPO_ICON: Record<string, string> = {
  tarea_asignada: '📋',
  tarea_bloqueada: '🔴',
  tarea_completada: '✅',
  mencion: '💬',
}

const ESTADO_STYLE: Record<string, string> = {
  espera: 'text-gray-400',
  en_curso: 'text-green-400',
  bloqueada: 'text-red-400',
}

function tiempoRelativo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'ahora'
  if (diff < 60) return `${diff}m`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

interface Props {
  rol: 'admin' | 'empleado'
}

export default function NotificacionesPanel({ rol }: Props) {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [tareas, setTareas] = useState<TareaHoy[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const fetchPanel = useCallback(async () => {
    if (rol === 'admin') {
      try {
        const r = await fetch('/api/alertas')
        if (r.ok) {
          const data = await r.json()
          setCount(Array.isArray(data) ? data.length : 0)
        }
      } catch { /* ignore */ }
      return
    }
    setLoading(true)
    try {
      const r = await fetch('/api/notificaciones/panel')
      if (!r.ok) return
      const data = await r.json() as { notificaciones: Notif[]; tareasHoy: TareaHoy[] }
      const n = data.notificaciones ?? []
      const t = data.tareasHoy ?? []
      setNotifs(n)
      setTareas(t)
      setCount(n.length + t.length)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [rol])

  // Load on mount to show badge count
  useEffect(() => { fetchPanel() }, [fetchPanel])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function toggleOpen() {
    if (!open && rol === 'empleado') fetchPanel()
    setOpen(o => !o)
  }

  async function marcarLeida(id: string) {
    setNotifs(prev => {
      const next = prev.filter(n => n.id !== id)
      setCount(tareas.length + next.length)
      return next
    })
    await fetch('/api/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
  }

  async function marcarTodas() {
    setNotifs([])
    setCount(tareas.length)
    await fetch('/api/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
  }

  // Para admins: link directo a alertas
  if (rol === 'admin') {
    return (
      <Link href="/alertas" className="relative group flex-shrink-0">
        <span className="text-xl">🔔</span>
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div ref={panelRef} className="relative flex-shrink-0">
      {/* Bell button */}
      <button
        onClick={toggleOpen}
        className="relative group p-1 rounded-lg hover:bg-gray-800 transition-colors"
        aria-label="Notificaciones"
      >
        <span className={`text-xl transition-all ${open ? 'scale-110' : ''}`}>🔔</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <span className="text-white font-semibold text-sm">Mis avisos</span>
            <div className="flex items-center gap-2">
              {notifs.length > 0 && (
                <button onClick={marcarTodas} className="text-[10px] text-gray-500 hover:text-white transition-colors">
                  Limpiar
                </button>
              )}
              <Link
                href="/alertas"
                onClick={() => setOpen(false)}
                className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                Ver todo →
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="px-4 py-8 text-center text-gray-500 text-xs">Cargando...</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {/* Tareas de hoy */}
              {tareas.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-800/50">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                      Tareas de hoy ({tareas.length})
                    </span>
                  </div>
                  {tareas.map(t => (
                    <Link
                      key={t.id}
                      href={`/tareas/vista-global?tarea=${t.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/60 transition-colors border-b border-gray-800/40"
                    >
                      <span className="text-sm">
                        {t.tipo === 'reunion' ? '🤝' : t.tipo === 'visita' ? '📍' : '📋'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate leading-tight">{t.nombre}</p>
                        {t.hora && (
                          <p className={`text-[11px] ${ESTADO_STYLE[t.estado] ?? 'text-gray-500'}`}>
                            {t.hora.slice(0, 5)} · {t.estado === 'en_curso' ? 'en proceso' : t.estado === 'bloqueada' ? 'bloqueada' : 'pendiente'}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Notificaciones no leídas */}
              {notifs.length > 0 && (
                <div>
                  {tareas.length > 0 && (
                    <div className="px-4 py-2 bg-gray-800/50">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                        Notificaciones
                      </span>
                    </div>
                  )}
                  {notifs.map(n => (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-blue-950/20 transition-colors border-b border-gray-800/40">
                      <span className="text-base mt-0.5 flex-shrink-0">{TIPO_ICON[n.tipo] ?? '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm text-white leading-tight">{n.titulo}</p>
                          <span className="text-[10px] text-gray-600 flex-shrink-0">{tiempoRelativo(n.created_at)}</span>
                        </div>
                        {n.mensaje && <p className="text-xs text-gray-400 mt-0.5">{n.mensaje}</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          {n.id_tarea && (
                            <Link
                              href={`/tareas/vista-global?tarea=${n.id_tarea}`}
                              onClick={() => { marcarLeida(n.id); setOpen(false) }}
                              className="text-[11px] text-blue-400 hover:text-blue-300"
                            >
                              Ver tarea →
                            </Link>
                          )}
                          <button
                            onClick={() => marcarLeida(n.id)}
                            className="text-[11px] text-gray-600 hover:text-gray-400"
                          >
                            ✕ Leída
                          </button>
                        </div>
                      </div>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {tareas.length === 0 && notifs.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-gray-500 text-sm">Todo al día</p>
                  <p className="text-gray-600 text-xs mt-1">No tienes tareas para hoy ni avisos</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
