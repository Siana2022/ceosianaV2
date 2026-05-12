'use client'

import { useEffect, useState } from 'react'

interface AlertaItem { nombre: string; detalle?: string }
interface Alerta {
  tipo: string
  label: string
  severidad: 'alta' | 'media' | 'baja'
  items: AlertaItem[]
}

const SEVERIDAD = {
  alta:  { bg: 'bg-red-950/60',    border: 'border-red-700/50',    icon: '🔴', badge: 'bg-red-900/60 text-red-400 border-red-700/50' },
  media: { bg: 'bg-yellow-950/40', border: 'border-yellow-700/40', icon: '🟡', badge: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/40' },
  baja:  { bg: 'bg-blue-950/30',   border: 'border-blue-700/30',   icon: '🔵', badge: 'bg-blue-900/30 text-blue-400 border-blue-700/30' },
}

export default function AlertasPanel() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())

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

  const toggle = (tipo: string) => {
    setExpandidas(prev => {
      const next = new Set(prev)
      next.has(tipo) ? next.delete(tipo) : next.add(tipo)
      return next
    })
  }

  if (!isAdmin || loading || alertas.length === 0) return null

  const altas = alertas.filter(a => a.severidad === 'alta')
  const medias = alertas.filter(a => a.severidad === 'media')
  const bajas = alertas.filter(a => a.severidad === 'baja')

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-semibold">Alertas</h3>
          <span className="text-xs text-gray-400">{alertas.length} activa{alertas.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          {altas.length > 0 && <span className="text-xs bg-red-900/60 text-red-400 border border-red-700/50 rounded-full px-2 py-0.5">{altas.length} alta{altas.length > 1 ? 's' : ''}</span>}
          {medias.length > 0 && <span className="text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-700/40 rounded-full px-2 py-0.5">{medias.length} media{medias.length > 1 ? 's' : ''}</span>}
          {bajas.length > 0 && <span className="text-xs bg-blue-900/30 text-blue-400 border border-blue-700/30 rounded-full px-2 py-0.5">{bajas.length} baja{bajas.length > 1 ? 's' : ''}</span>}
        </div>
      </div>

      <div className="divide-y divide-gray-800/50">
        {alertas.map(a => {
          const style = SEVERIDAD[a.severidad]
          const expanded = expandidas.has(a.tipo)
          return (
            <div key={a.tipo} className={`${style.bg}`}>
              <button
                onClick={() => toggle(a.tipo)}
                className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm">{style.icon}</span>
                  <span className="text-white font-medium text-sm">{a.label}</span>
                  <span className={`text-[11px] border rounded-full px-2 py-0.5 ${style.badge}`}>
                    {a.items.length} {a.items.length === 1 ? 'elemento' : 'elementos'}
                  </span>
                </div>
                <span className="text-gray-500 text-xs">{expanded ? '▲' : '▼'}</span>
              </button>

              {expanded && (
                <div className="px-6 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {a.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 bg-gray-900/60 rounded-lg px-3 py-2">
                        <span className="text-gray-300 text-sm font-medium">{item.nombre}</span>
                        {item.detalle && (
                          <span className="text-gray-500 text-xs ml-auto whitespace-nowrap">{item.detalle}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
