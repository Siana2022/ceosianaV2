'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import NotificacionesEmpleado from '@/components/NotificacionesEmpleado'

interface TareaPanel { id: string; nombre: string; tipo: string; estado: string; hora: string | null; fecha_limite: string }

function TareasActivasEmpleado() {
  const [tareas, setTareas] = useState<TareaPanel[]>([])
  const [hoy, setHoy] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notificaciones/panel')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setTareas(data.tareasHoy ?? []); setHoy(data.hoy ?? '') }
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading || tareas.length === 0) return null

  function urgencia(f: string) { return f < hoy ? 'vencida' : f === hoy ? 'hoy' : 'proxima' }
  function labelFecha(f: string) {
    if (f < hoy) { const d = Math.floor((new Date(hoy).getTime() - new Date(f).getTime()) / 86400000); return `Vencida hace ${d}d` }
    if (f === hoy) return 'Hoy'
    return new Date(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h3 className="text-white font-semibold">Mis tareas activas</h3>
        <p className="text-gray-500 text-xs mt-0.5">{tareas.length} tarea{tareas.length !== 1 ? 's' : ''} pendiente{tareas.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="divide-y divide-gray-800/50">
        {tareas.map(t => {
          const u = urgencia(t.fecha_limite)
          return (
            <Link key={t.id} href={`/tareas/vista-global?tarea=${t.id}`}
              className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-800/40 transition-colors">
              <span className="text-base">{t.tipo === 'reunion' ? '🤝' : t.tipo === 'visita' ? '📍' : '📋'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{t.nombre}</p>
                <p className={`text-xs mt-0.5 ${u === 'vencida' ? 'text-red-400' : u === 'hoy' ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {labelFecha(t.fecha_limite)}{t.hora ? ` · ${t.hora.slice(0, 5)}` : ''}
                  {t.estado === 'bloqueada' ? ' · bloqueada' : t.estado === 'en_curso' ? ' · en proceso' : ''}
                </p>
              </div>
              <span className="text-gray-600 text-xs">Ver →</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

interface AlertaItem { nombre: string; detalle?: string }
interface Alerta {
  tipo: string
  label: string
  severidad: 'alta' | 'media' | 'baja'
  items: AlertaItem[]
}

const SEVERIDAD = {
  alta:  { bg: 'bg-red-950/40',    border: 'border-red-700/50',    icon: '🔴', badge: 'bg-red-900/60 text-red-400 border-red-700/50',    titulo: 'Alta' },
  media: { bg: 'bg-yellow-950/30', border: 'border-yellow-700/40', icon: '🟡', badge: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/40', titulo: 'Media' },
  baja:  { bg: 'bg-blue-950/20',   border: 'border-blue-700/30',   icon: '🔵', badge: 'bg-blue-900/30 text-blue-400 border-blue-700/30',   titulo: 'Baja' },
}

export default function AlertasPageClient() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/alertas')
      .then(async r => {
        if (r.status === 403) { setLoading(false); return }
        setIsAdmin(true)
        const data = await r.json()
        setAlertas(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white mb-2">Notificaciones</h2>
        <p className="text-gray-500 text-sm">Cargando...</p>
      </div>
    )
  }

  // EMPLEADO: notificaciones personales + tareas activas
  if (!isAdmin) {
    return (
      <div className="p-6 max-w-2xl space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Notificaciones</h2>
          <p className="text-gray-400 text-sm mt-1">Tareas y avisos asignados a ti</p>
        </div>
        <TareasActivasEmpleado />
        <NotificacionesEmpleado />
      </div>
    )
  }

  // ADMIN: alertas de negocio + notificaciones personales
  const altas  = alertas.filter(a => a.severidad === 'alta')
  const medias = alertas.filter(a => a.severidad === 'media')
  const bajas  = alertas.filter(a => a.severidad === 'baja')

  return (
    <div className="p-6 space-y-8">
      {/* Notificaciones personales del admin */}
      <div className="max-w-2xl">
        <NotificacionesEmpleado />
      </div>

      {/* Alertas de negocio */}
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Alertas de negocio</h2>
            <p className="text-gray-400 text-sm mt-1">
              {alertas.length === 0
                ? 'No hay alertas activas'
                : `${alertas.length} alerta${alertas.length > 1 ? 's' : ''} activa${alertas.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {altas.length > 0  && <span className="text-xs bg-red-900/60 text-red-400 border border-red-700/50 rounded-full px-3 py-1">{altas.length} alta{altas.length > 1 ? 's' : ''}</span>}
            {medias.length > 0 && <span className="text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-700/40 rounded-full px-3 py-1">{medias.length} media{medias.length > 1 ? 's' : ''}</span>}
            {bajas.length > 0  && <span className="text-xs bg-blue-900/30 text-blue-400 border border-blue-700/30 rounded-full px-3 py-1">{bajas.length} baja{bajas.length > 1 ? 's' : ''}</span>}
            <Link
              href="/administracion"
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5 transition-colors"
            >
              ⚙️ Configurar
            </Link>
          </div>
        </div>

        {alertas.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-lg font-medium text-gray-500">Todo en orden</p>
            <p className="text-sm mt-1">No hay alertas activas en este momento</p>
          </div>
        )}

        {(['alta', 'media', 'baja'] as const).map(sev => {
          const grupo = alertas.filter(a => a.severidad === sev)
          if (grupo.length === 0) return null
          const style = SEVERIDAD[sev]
          return (
            <div key={sev} className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                Prioridad {style.titulo}
              </h3>
              {grupo.map(a => (
                <div key={a.tipo} className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <span>{style.icon}</span>
                      <span className="text-white font-semibold">{a.label}</span>
                    </div>
                    <span className={`text-xs border rounded-full px-2.5 py-0.5 ${style.badge}`}>
                      {a.items.length} {a.items.length === 1 ? 'elemento' : 'elementos'}
                    </span>
                  </div>
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {a.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-900/50 rounded-lg px-3 py-2.5">
                          <span className="text-gray-200 text-sm font-medium">{item.nombre}</span>
                          {item.detalle && (
                            <span className="text-gray-500 text-xs ml-3 shrink-0">{item.detalle}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
