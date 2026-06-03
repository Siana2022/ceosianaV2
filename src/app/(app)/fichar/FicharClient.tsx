'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Perfil { id: string; id_empleado: string | null; rol: 'admin' | 'empleado' }
interface Servicio {
  id: string; nombre: string | null; notas: string | null
  departamento: { id: string; nombre: string } | null
  cliente: { id: string; nombre: string } | null
}
interface Departamento { id: string; nombre: string }
interface Cliente { id: string; nombre: string }
interface Empleado { id: string; nombre: string }
interface TimeLog {
  id: string; id_empleado: string; descripcion: string; fecha: string
  hora_inicio: string | null; hora_fin: string | null; minutos: number
  servicio: { id: string; nombre: string | null; notas: string | null } | null
  cliente: { id: string; nombre: string } | null
  departamento: { id: string; nombre: string } | null
  empleado: { id: string; nombre: string } | null
}

interface Props {
  perfil: Perfil
  empleadoNombre: string
  servicios: Servicio[]
  departamentos: Departamento[]
  clientes: Cliente[]
  empleados: Empleado[]
}

const TIMER_KEY = 'ceosiana_timer'

function fmtMinutos(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h > 0) return `${h}h ${min > 0 ? `${min}m` : ''}`
  return `${min}m`
}

function fmtSeconds(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function FicharClient({ perfil, empleadoNombre, servicios, departamentos, clientes, empleados }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'fichar' | 'historial' | 'equipo'>('fichar')

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerStart, setTimerStart] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Form state
  const [descripcion, setDescripcion] = useState('')
  const [servicioId, setServicioId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [departamentoId, setDepartamentoId] = useState('')
  const [fecha, setFecha] = useState(todayStr())
  const [manualHoras, setManualHoras] = useState('')
  const [manualMinutos, setManualMinutos] = useState('')
  const [modo, setModo] = useState<'timer' | 'manual'>('timer')

  // Logs state
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Admin: filter by employee
  const [filtroEmpleado, setFiltroEmpleado] = useState('')
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().substring(0, 7))

  // Restore timer from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(TIMER_KEY)
    if (saved) {
      try {
        const { startTs, descripcion: d, servicioId: s, clienteId: c, departamentoId: dep } = JSON.parse(saved)
        setTimerStart(startTs)
        setTimerRunning(true)
        setDescripcion(d ?? '')
        setServicioId(s ?? '')
        setClienteId(c ?? '')
        setDepartamentoId(dep ?? '')
        setElapsed(Math.floor((Date.now() - startTs) / 1000))
      } catch { localStorage.removeItem(TIMER_KEY) }
    }
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tick
  useEffect(() => {
    if (timerRunning && timerStart) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - timerStart) / 1000))
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerRunning, timerStart])

  // Auto-fill cliente/departamento when servicio changes
  useEffect(() => {
    if (!servicioId) return
    const s = servicios.find(sv => sv.id === servicioId)
    if (s?.cliente?.id) setClienteId(s.cliente.id)
    if (s?.departamento?.id) setDepartamentoId(s.departamento.id)
  }, [servicioId, servicios])

  async function fetchLogs() {
    setLoadingLogs(true)
    try {
      const params = new URLSearchParams()
      if (filtroMes) params.set('fecha', filtroMes)
      if (perfil.rol === 'admin' && filtroEmpleado) params.set('id_empleado', filtroEmpleado)
      const res = await fetch(`/api/time-logs?${params}`)
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } finally {
      setLoadingLogs(false)
    }
  }

  function startTimer() {
    if (!descripcion.trim()) { setError('Añade una descripción antes de iniciar'); return }
    setError('')
    const now = Date.now()
    setTimerStart(now)
    setTimerRunning(true)
    setElapsed(0)
    localStorage.setItem(TIMER_KEY, JSON.stringify({
      startTs: now, descripcion, servicioId, clienteId, departamentoId
    }))
  }

  async function stopTimer() {
    if (!timerStart) return
    const minutos = Math.max(1, Math.round(elapsed / 60))
    const horaInicio = new Date(timerStart)
    const horaFin = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const hi = `${pad(horaInicio.getHours())}:${pad(horaInicio.getMinutes())}`
    const hf = `${pad(horaFin.getHours())}:${pad(horaFin.getMinutes())}`

    setTimerRunning(false)
    setTimerStart(null)
    setElapsed(0)
    localStorage.removeItem(TIMER_KEY)

    await guardar({ minutos, hora_inicio: hi, hora_fin: hf, fecha: todayStr() })
  }

  async function guardarManual() {
    const h = parseInt(manualHoras || '0')
    const m = parseInt(manualMinutos || '0')
    const minutos = h * 60 + m
    if (minutos <= 0) { setError('Introduce al menos 1 minuto'); return }
    await guardar({ minutos, hora_inicio: null, hora_fin: null, fecha })
  }

  async function guardar({ minutos, hora_inicio, hora_fin, fecha: f }: {
    minutos: number; hora_inicio: string | null; hora_fin: string | null; fecha: string
  }) {
    if (!descripcion.trim()) { setError('La descripción es obligatoria'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/time-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion, fecha: f,
          hora_inicio, hora_fin, minutos,
          id_servicio: servicioId || null,
          id_cliente: clienteId || null,
          id_departamento: departamentoId || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      setDescripcion('')
      setServicioId('')
      setClienteId('')
      setDepartamentoId('')
      setManualHoras('')
      setManualMinutos('')
      await fetchLogs()
      setTab('historial')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este registro?')) return
    await fetch(`/api/time-logs?id=${id}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  const totalMinutosHoy = logs
    .filter(l => l.fecha === todayStr())
    .reduce((s, l) => s + l.minutos, 0)

  const totalMinutosMes = logs.reduce((s, l) => s + l.minutos, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Control de tiempos</h2>
          <p className="text-gray-400 text-sm mt-1">
            {empleadoNombre} ·{' '}
            <span className={perfil.rol === 'admin' ? 'text-blue-400' : 'text-green-400'}>
              {perfil.rol === 'admin' ? 'Admin' : 'Empleado'}
            </span>
          </p>
        </div>
        {/* KPIs */}
        <div className="flex gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-gray-500">Hoy</p>
            <p className="text-white font-bold text-lg">{fmtMinutos(totalMinutosHoy)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-gray-500">{filtroMes}</p>
            <p className="text-white font-bold text-lg">{fmtMinutos(totalMinutosMes)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800">
        {(['fichar', 'historial'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t === 'fichar' ? '⏱️ Fichar' : '📋 Historial'}
          </button>
        ))}
        {perfil.rol === 'admin' && (
          <button
            onClick={() => { setTab('equipo'); fetchLogs() }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === 'equipo' ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            👥 Equipo
          </button>
        )}
      </div>

      {/* ── TAB: FICHAR ── */}
      {tab === 'fichar' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            {/* Modo toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setModo('timer')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  modo === 'timer' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                ⏱️ Cronómetro
              </button>
              <button
                onClick={() => setModo('manual')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  modo === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                ✏️ Manual
              </button>
            </div>

            {/* Descripcion */}
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1">Tarea realizada *</label>
              <input
                type="text"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Ej: Revisión diseño web, reunión cliente..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Servicio */}
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1">Proyecto / Servicio</label>
              <select
                value={servicioId}
                onChange={e => setServicioId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">— Sin proyecto específico —</option>
                {servicios.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.cliente?.nombre ? `${s.cliente.nombre} · ` : ''}{s.notas ?? s.nombre ?? s.id}
                    {s.departamento ? ` (${s.departamento.nombre})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Cliente + Departamento (si no viene del servicio) */}
            {!servicioId && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">Cliente</label>
                  <select
                    value={clienteId}
                    onChange={e => setClienteId(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">— Ninguno —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">Departamento</label>
                  <select
                    value={departamentoId}
                    onChange={e => setDepartamentoId(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">— Ninguno —</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Timer mode */}
            {modo === 'timer' && (
              <div className="space-y-3">
                {timerRunning && (
                  <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl p-4 text-center">
                    <p className="text-4xl font-mono font-bold text-blue-300">{fmtSeconds(elapsed)}</p>
                    <p className="text-xs text-blue-500 mt-1">Cronómetro en marcha</p>
                  </div>
                )}
                {timerRunning ? (
                  <button
                    onClick={stopTimer}
                    disabled={saving}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    ⏹ Parar y guardar
                  </button>
                ) : (
                  <button
                    onClick={startTimer}
                    disabled={saving}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    ▶ Iniciar cronómetro
                  </button>
                )}
              </div>
            )}

            {/* Manual mode */}
            {modo === 'manual' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1">Fecha</label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={e => setFecha(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1">Horas</label>
                    <input
                      type="number" min="0" max="23"
                      value={manualHoras}
                      onChange={e => setManualHoras(e.target.value)}
                      placeholder="0"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1">Minutos</label>
                    <input
                      type="number" min="0" max="59"
                      value={manualMinutos}
                      onChange={e => setManualMinutos(e.target.value)}
                      placeholder="0"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={guardarManual}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : '💾 Guardar registro'}
                </button>
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>

          {/* Today's logs preview */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">Registros de hoy</h3>
              <p className="text-gray-500 text-xs mt-0.5">{fmtMinutos(totalMinutosHoy)} fichados</p>
            </div>
            <div className="divide-y divide-gray-800/50 max-h-80 overflow-y-auto">
              {logs.filter(l => l.fecha === todayStr()).length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">Sin registros hoy todavía</p>
              ) : (
                logs.filter(l => l.fecha === todayStr()).map(l => (
                  <div key={l.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-800/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{l.descripcion}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {l.cliente?.nombre ?? l.departamento?.nombre ?? '—'}
                        {l.hora_inicio && l.hora_fin ? ` · ${l.hora_inicio}–${l.hora_fin}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-blue-400 font-medium text-sm">{fmtMinutos(l.minutos)}</span>
                      <button onClick={() => handleDelete(l.id)} className="text-gray-600 hover:text-red-400 text-xs transition-colors">✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: HISTORIAL ── */}
      {tab === 'historial' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-white font-semibold">Mis registros</h3>
              <p className="text-gray-500 text-xs mt-0.5">{logs.length} entradas · {fmtMinutos(totalMinutosMes)} este mes</p>
            </div>
            <input
              type="month"
              value={filtroMes}
              onChange={e => { setFiltroMes(e.target.value); setTimeout(fetchLogs, 0) }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          {loadingLogs ? (
            <p className="text-gray-500 text-sm py-10 text-center">Cargando...</p>
          ) : logs.length === 0 ? (
            <p className="text-gray-500 text-sm py-10 text-center">Sin registros este mes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                    <th className="text-left px-6 py-3">Fecha</th>
                    <th className="text-left px-4 py-3">Tarea</th>
                    <th className="text-left px-4 py-3">Cliente / Proyecto</th>
                    <th className="text-left px-4 py-3">Depto</th>
                    <th className="text-right px-4 py-3">Tiempo</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-6 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(l.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        {l.hora_inicio && <span className="block text-gray-600">{l.hora_inicio}–{l.hora_fin}</span>}
                      </td>
                      <td className="px-4 py-3 text-white max-w-[220px] truncate" title={l.descripcion}>{l.descripcion}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{l.cliente?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{l.departamento?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-blue-400 font-medium">{fmtMinutos(l.minutos)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(l.id)} className="text-gray-600 hover:text-red-400 text-xs transition-colors">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-700 bg-gray-800/30">
                    <td colSpan={4} className="px-6 py-3 text-gray-400 text-sm font-medium">Total</td>
                    <td className="px-4 py-3 text-right text-white font-bold">{fmtMinutos(totalMinutosMes)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: EQUIPO (ADMIN) ── */}
      {tab === 'equipo' && perfil.rol === 'admin' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={filtroEmpleado}
              onChange={e => { setFiltroEmpleado(e.target.value); setTimeout(fetchLogs, 0) }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Todos los empleados</option>
              {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <input
              type="month"
              value={filtroMes}
              onChange={e => { setFiltroMes(e.target.value); setTimeout(fetchLogs, 0) }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={fetchLogs}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Actualizar
            </button>
          </div>

          {/* Summary by employee */}
          {(() => {
            const byEmp = new Map<string, { nombre: string; minutos: number; logs: number }>()
            for (const l of logs) {
              const nombre = l.empleado?.nombre ?? l.id_empleado
              if (!byEmp.has(l.id_empleado)) byEmp.set(l.id_empleado, { nombre, minutos: 0, logs: 0 })
              byEmp.get(l.id_empleado)!.minutos += l.minutos
              byEmp.get(l.id_empleado)!.logs += 1
            }
            const rows = Array.from(byEmp.values()).sort((a, b) => b.minutos - a.minutos)
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {rows.map(r => (
                  <div key={r.nombre} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <p className="text-white font-medium text-sm truncate">{r.nombre}</p>
                    <p className="text-blue-400 font-bold text-xl mt-1">{fmtMinutos(r.minutos)}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{r.logs} registro{r.logs !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Full log table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">Registro completo del equipo</h3>
              <p className="text-gray-500 text-xs mt-0.5">{logs.length} entradas · {fmtMinutos(logs.reduce((s, l) => s + l.minutos, 0))} totales</p>
            </div>
            {loadingLogs ? (
              <p className="text-gray-500 text-sm py-10 text-center">Cargando...</p>
            ) : logs.length === 0 ? (
              <p className="text-gray-500 text-sm py-10 text-center">Sin registros</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                      <th className="text-left px-6 py-3">Fecha</th>
                      <th className="text-left px-4 py-3">Empleado</th>
                      <th className="text-left px-4 py-3">Tarea</th>
                      <th className="text-left px-4 py-3">Cliente</th>
                      <th className="text-left px-4 py-3">Depto</th>
                      <th className="text-right px-4 py-3">Tiempo</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-6 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(l.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="px-4 py-2.5 text-white text-sm">{l.empleado?.nombre ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-300 max-w-[200px] truncate" title={l.descripcion}>{l.descripcion}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{l.cliente?.nombre ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{l.departamento?.nombre ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-blue-400 font-medium">{fmtMinutos(l.minutos)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => handleDelete(l.id)} className="text-gray-600 hover:text-red-400 text-xs transition-colors">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
