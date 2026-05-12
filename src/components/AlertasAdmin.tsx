'use client'

import { useState } from 'react'

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
  alertasConfig: AlertaConfig[]
  admins: AdminUser[]
  currentEmail: string
}

export default function AlertasAdmin({ alertasConfig: initial, admins: initialAdmins, currentEmail }: Props) {
  const [config, setConfig] = useState(initial)
  const [admins, setAdmins] = useState(initialAdmins)
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [error, setError] = useState('')

  const toggleAlerta = async (tipo: string, activa: boolean) => {
    setSaving(tipo)
    const res = await fetch('/api/alertas-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, activa }),
    })
    if (res.ok) {
      setConfig(prev => prev.map(c => c.tipo === tipo ? { ...c, activa } : c))
    }
    setSaving(null)
  }

  const addAdmin = async () => {
    if (!newEmail.trim()) return
    setAddingAdmin(true)
    setError('')
    const res = await fetch('/api/alertas-admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setAdmins(prev => [...prev, data])
      setNewEmail('')
    } else {
      const err = await res.json()
      setError(err.error ?? 'Error al añadir')
    }
    setAddingAdmin(false)
  }

  const removeAdmin = async (id: string) => {
    const res = await fetch('/api/alertas-admins', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setAdmins(prev => prev.filter(a => a.id !== id))
    } else {
      const err = await res.json()
      setError(err.error ?? 'Error al eliminar')
    }
  }

  const SEVERIDAD_LABEL: Record<string, string> = {
    margen_negativo: 'Alta',
    sin_ingresos_mes: 'Media',
    sin_responsable: 'Media',
    sin_dedicacion: 'Baja',
    cliente_inactivo_servicios: 'Baja',
  }
  const SEVERIDAD_COLOR: Record<string, string> = {
    Alta: 'text-red-400 bg-red-900/30 border-red-700/40',
    Media: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40',
    Baja: 'text-blue-400 bg-blue-900/30 border-blue-700/40',
  }

  return (
    <div className="space-y-6">
      {/* Alertas config */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Configuración de alertas</h3>
          <p className="text-gray-500 text-xs mt-1">Activa o desactiva las alertas que recibirás en el dashboard</p>
        </div>
        <div className="divide-y divide-gray-800/50">
          {config.map(c => {
            const sev = SEVERIDAD_LABEL[c.tipo] ?? 'Media'
            const sevColor = SEVERIDAD_COLOR[sev]
            return (
              <div key={c.tipo} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleAlerta(c.tipo, !c.activa)}
                    disabled={saving === c.tipo}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                      c.activa ? 'bg-blue-600' : 'bg-gray-700'
                    } ${saving === c.tipo ? 'opacity-50' : ''}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                      c.activa ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{c.label}</span>
                      <span className={`text-[11px] border rounded-full px-1.5 py-0.5 ${sevColor}`}>{sev}</span>
                    </div>
                    {c.descripcion && (
                      <p className="text-gray-500 text-xs mt-0.5">{c.descripcion}</p>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-medium ${c.activa ? 'text-green-400' : 'text-gray-600'}`}>
                  {c.activa ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Admins */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Administradores de alertas</h3>
          <p className="text-gray-500 text-xs mt-1">Solo estos usuarios pueden ver y configurar alertas</p>
        </div>
        <div className="divide-y divide-gray-800/50">
          {admins.map(a => (
            <div key={a.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600/20 border border-blue-600/30 rounded-full flex items-center justify-center text-blue-400 text-xs font-bold">
                  {a.email[0].toUpperCase()}
                </div>
                <span className="text-white text-sm">{a.email}</span>
                {a.email === currentEmail && (
                  <span className="text-[11px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">tú</span>
                )}
              </div>
              {a.email !== currentEmail && (
                <button
                  onClick={() => removeAdmin(a.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-xs px-2 py-1 rounded hover:bg-gray-800"
                >
                  Eliminar
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <input
              type="email"
              placeholder="nuevo@email.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAdmin()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={addAdmin}
              disabled={addingAdmin || !newEmail.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Añadir admin
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}
