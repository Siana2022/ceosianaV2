'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Perfil {
  email: string
  rol: string
  slack_username: string | null
  google_calendar_id: string | null
  googleConnected: boolean
}

export default function PerfilPage() {
  const params = useSearchParams()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [slack, setSlack] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Configuración de agencia (solo admin)
  const [umbral, setUmbral] = useState('')
  const [umbralSaving, setUmbralSaving] = useState(false)
  const [umbralMsg, setUmbralMsg] = useState('')

  // Password change
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')

  async function changePassword() {
    if (pwd.length < 6) { setPwdMsg('La contraseña debe tener al menos 6 caracteres'); return }
    if (pwd !== pwd2) { setPwdMsg('Las contraseñas no coinciden'); return }
    setPwdSaving(true)
    setPwdMsg('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setPwdSaving(false)
    if (error) { setPwdMsg(`❌ ${error.message}`); return }
    setPwd(''); setPwd2('')
    setPwdMsg('✅ Contraseña actualizada')
    setTimeout(() => setPwdMsg(''), 3000)
  }

  const load = useCallback(async () => {
    const res = await fetch('/api/perfil')
    if (res.ok) {
      const data = await res.json() as Perfil
      setPerfil(data)
      setSlack(data.slack_username ?? '')
    }
    // Load config for admins
    const cfgRes = await fetch('/api/configuracion')
    if (cfgRes.ok) {
      const cfg = await cfgRes.json() as Record<string, string>
      setUmbral(cfg['coste_hora_umbral'] ?? '300')
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (params.get('connected') === '1') setMsg('✅ Google Calendar conectado correctamente')
    if (params.get('error') === 'google_denied') setMsg('⚠️ Conexión cancelada')
    if (params.get('error') === 'token_failed') setMsg('❌ Error al conectar con Google')
  }, [params])

  async function saveSlack() {
    setSaving(true)
    await fetch('/api/perfil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slack_username: slack }) })
    setSaving(false)
    setMsg('✅ Guardado')
    setTimeout(() => setMsg(''), 2000)
  }

  async function saveUmbral() {
    const val = parseFloat(umbral)
    if (isNaN(val) || val <= 0) { setUmbralMsg('❌ Introduce un valor válido mayor que 0'); return }
    setUmbralSaving(true)
    setUmbralMsg('')
    const res = await fetch('/api/configuracion', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave: 'coste_hora_umbral', valor: String(val) }),
    })
    setUmbralSaving(false)
    if (res.ok) {
      setUmbralMsg('✅ Guardado')
      setTimeout(() => setUmbralMsg(''), 2000)
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string }
      setUmbralMsg(`❌ ${d.error ?? 'Error al guardar'}`)
    }
  }

  async function disconnectGoogle() {
    if (!confirm('¿Desconectar Google Calendar?')) return
    await fetch('/api/perfil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disconnect_google: true }) })
    await load()
    setMsg('Google Calendar desconectado')
  }

  if (!perfil) return <div className="p-8 text-gray-400">Cargando...</div>

  return (
    <div className="p-8 max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Mi perfil</h1>
        <p className="text-gray-500 text-sm mt-1">{perfil.email} · <span className="capitalize">{perfil.rol}</span></p>
      </div>

      {msg && <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white">{msg}</div>}

      {/* Slack */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <span className="text-lg">💬</span> Slack
        </h2>
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Usuario de Slack</label>
          <div className="flex gap-2">
            <input
              value={slack}
              onChange={e => setSlack(e.target.value)}
              placeholder="@tunombre"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <button onClick={saveSlack} disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* Cambiar contraseña */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <span className="text-lg">🔒</span> Cambiar contraseña
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Nueva contraseña</label>
            <input
              type="password"
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Confirmar contraseña</label>
            <input
              type="password"
              value={pwd2}
              onChange={e => setPwd2(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              onKeyDown={e => e.key === 'Enter' && changePassword()}
            />
          </div>
          {pwdMsg && <p className="text-sm">{pwdMsg}</p>}
          <button
            onClick={changePassword}
            disabled={pwdSaving || !pwd || !pwd2}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 w-full"
          >
            {pwdSaving ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </div>
      </div>

      {/* Google Calendar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <span className="text-lg">📅</span> Google Calendar
        </h2>
        {perfil.googleConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
              Conectado — las tareas se sincronizan automáticamente
            </div>
            <button onClick={disconnectGoogle}
              className="text-red-400 hover:text-red-300 text-sm underline">
              Desconectar Google Calendar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">Conecta tu Google Calendar para sincronizar automáticamente las fechas de tus tareas.</p>
            <a href="/api/auth/google"
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Conectar con Google
            </a>
          </div>
        )}
      </div>

      {/* Configuración de agencia — solo admins */}
      {perfil.rol === 'admin' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <span className="text-lg">⚙️</span> Configuración de agencia
          </h2>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
              Umbral rentabilidad (€/hora)
            </label>
            <p className="text-gray-500 text-xs mb-3">
              Los clientes con €/hora por encima de este valor se consideran rentables (verde). Por debajo, bajo margen (rojo).
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={umbral}
                onChange={e => setUmbral(e.target.value)}
                placeholder="300"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={saveUmbral}
                disabled={umbralSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {umbralSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
            {umbralMsg && <p className="text-sm mt-2">{umbralMsg}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
