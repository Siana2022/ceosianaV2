'use client'

import { useState, useEffect, useRef, useMemo } from 'react'

interface Perfil { id: string; id_empleado: string | null; rol: 'admin' | 'empleado' }
interface Servicio {
  id: string; nombre: string | null; notas: string | null
  departamento: { id: string; nombre: string } | null | { id: string; nombre: string }[]
  cliente: { id: string; nombre: string } | null | { id: string; nombre: string }[]
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
  perfil: Perfil; empleadoNombre: string
  servicios: Servicio[]; departamentos: Departamento[]
  clientes: Cliente[]; empleados: Empleado[]
}

const TIMER_KEY = 'ceosiana_timer'

function fmtMin(m: number) {
  const h = Math.floor(m / 60); const min = m % 60
  if (h > 0) return `${h}h ${min > 0 ? `${min}m` : ''}`.trim()
  return `${min}m`
}
function fmtSec(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}
function todayStr() { return new Date().toISOString().split('T')[0] }

function getClienteNombre(s: Servicio): string {
  if (!s.cliente) return ''
  if (Array.isArray(s.cliente)) return s.cliente[0]?.nombre ?? ''
  return s.cliente.nombre ?? ''
}
function getDepartamentoNombre(s: Servicio): string {
  if (!s.departamento) return ''
  if (Array.isArray(s.departamento)) return s.departamento[0]?.nombre ?? ''
  return s.departamento.nombre ?? ''
}

// ─── TIMER TAB ────────────────────────────────────────────────────────────────
function TabFichar({ perfil, empleadoNombre, servicios, departamentos, clientes, onSaved }: {
  perfil: Perfil; empleadoNombre: string; servicios: Servicio[]
  departamentos: Departamento[]; clientes: Cliente[]; onSaved: () => void
}) {
  const [modo, setModo] = useState<'timer' | 'manual'>('timer')
  const [descripcion, setDescripcion] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [proyectoOtrosId, setProyectoOtrosId] = useState('')   // servicio dentro de Otros
  const [proyectoOtrosManual, setProyectoOtrosManual] = useState('') // texto libre si Manual
  const [departamentoId, setDepartamentoId] = useState('')
  const [departamentoOtros, setDepartamentoOtros] = useState('')
  const [fecha, setFecha] = useState(todayStr())
  const [manualHoras, setManualHoras] = useState('')
  const [manualMin, setManualMin] = useState('30')
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerStart, setTimerStart] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Restore timer
  useEffect(() => {
    const saved = localStorage.getItem(TIMER_KEY)
    if (saved) {
      try {
        const { startTs, d, c, dep } = JSON.parse(saved)
        setTimerStart(startTs); setTimerRunning(true)
        setDescripcion(d ?? ''); setClienteId(c ?? ''); setDepartamentoId(dep ?? '')
        setElapsed(Math.floor((Date.now() - startTs) / 1000))
      } catch { localStorage.removeItem(TIMER_KEY) }
    }
  }, [])

  useEffect(() => {
    if (timerRunning && timerStart) {
      intervalRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - timerStart) / 1000)), 1000)
    } else { if (intervalRef.current) clearInterval(intervalRef.current) }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerRunning, timerStart])

  function startTimer() {
    if (!descripcion.trim()) { setError('Añade una descripción'); return }
    setError(''); const now = Date.now()
    setTimerStart(now); setTimerRunning(true); setElapsed(0)
    localStorage.setItem(TIMER_KEY, JSON.stringify({ startTs: now, d: descripcion, c: clienteId, dep: departamentoId }))
  }

  async function stopTimer() {
    if (!timerStart) return
    const minutos = Math.max(1, Math.round(elapsed / 60))
    const pad = (n: number) => String(n).padStart(2, '0')
    const hi = `${pad(new Date(timerStart).getHours())}:${pad(new Date(timerStart).getMinutes())}`
    const hf = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
    setTimerRunning(false); setTimerStart(null); setElapsed(0)
    localStorage.removeItem(TIMER_KEY)
    await save({ minutos, hora_inicio: hi, hora_fin: hf, fecha: todayStr() })
  }

  async function saveManual() {
    const mins = parseInt(manualHoras || '0') * 60 + parseInt(manualMin || '0')
    if (mins <= 0) { setError('Introduce al menos 1 minuto'); return }
    await save({ minutos: mins, hora_inicio: null, hora_fin: null, fecha })
  }

  async function save(extra: { minutos: number; hora_inicio: string | null; hora_fin: string | null; fecha: string }) {
    if (!descripcion.trim()) { setError('La descripción es obligatoria'); return }
    setSaving(true); setError('')
    try {
      let finalDesc = descripcion
      let finalClienteId: string | null = clienteId || null
      let finalDeptId: string | null = departamentoId || null
      let finalServicioId: string | null = null

      const esOtrosCliente = clienteTieneProyectos()

      if (clienteId === '__otros__') {
        finalClienteId = null
      }

      // Si es Otros: usar proyecto seleccionado o texto manual
      if (esOtrosCliente) {
        if (proyectoOtrosId && proyectoOtrosId !== '__manual__') {
          finalServicioId = proyectoOtrosId
        } else if (proyectoOtrosId === '__manual__' && proyectoOtrosManual.trim()) {
          finalDesc = `[${proyectoOtrosManual.trim()}] ${finalDesc}`
        }
      }

      if (departamentoId === '__otros__') {
        finalDeptId = null
        if (departamentoOtros.trim()) finalDesc = `[Dpto: ${departamentoOtros.trim()}] ${finalDesc}`
      }

      const res = await fetch('/api/time-logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion: finalDesc, ...extra, id_servicio: finalServicioId, id_cliente: finalClienteId, id_departamento: finalDeptId }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      setDescripcion(''); setClienteId(''); setProyectoOtrosId(''); setProyectoOtrosManual('')
      setDepartamentoId(''); setDepartamentoOtros('')
      setManualHoras(''); setManualMin('30')
      onSaved()
    } finally { setSaving(false) }
  }

  const CLIENTES_CON_PROYECTOS = ['otros', 'way', 'mentorías', 'mentorias', 'ment/form']

  // Helper: ¿el cliente seleccionado necesita segundo desplegable?
  function clienteTieneProyectos() {
    if (clienteId === '__otros__') return true
    if (!clienteId) return false
    const nombre = clientes.find(c => c.id === clienteId)?.nombre?.toLowerCase() ?? ''
    return CLIENTES_CON_PROYECTOS.includes(nombre)
  }

  // Proyectos del cliente seleccionado
  function serviciosDelCliente(): Servicio[] {
    if (clienteId === '__otros__') return servicios
    const nombre = clientes.find(c => c.id === clienteId)?.nombre ?? ''
    return servicios.filter(s => getClienteNombre(s).toLowerCase() === nombre.toLowerCase())
  }

  const activeCliente = clientes.find(c => c.id === clienteId)?.nombre ?? ''
  const activeDept = departamentos.find(d => d.id === departamentoId)?.nombre ?? ''

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT: Timer + Form */}
      <div className="lg:col-span-5 space-y-4">
        {/* Chronometer card */}
        <div className="rounded-2xl border border-gray-800 bg-black p-6 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-green-600/8 blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <span className={`h-2.5 w-2.5 rounded-full ${timerRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-700'}`} />
                {timerRunning ? 'Fichaje activo' : 'En reposo'}
              </span>
              <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-blue-400 font-bold tracking-tight">SIANA CRM</span>
            </div>

            {timerRunning ? (
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tiempo acumulado</p>
                <div className="font-mono text-5xl font-black text-green-400 tracking-tight drop-shadow-[0_0_16px_rgba(74,222,128,0.3)]">
                  {fmtSec(elapsed)}
                </div>
                <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4 text-left">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Tarea:</p>
                  <p className="text-sm font-semibold text-white line-clamp-2">{descripcion}</p>
                  <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
                    {activeCliente && <span className="text-gray-300">{activeCliente}</span>}
                    {activeDept && <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{activeDept}</span>}
                  </div>
                </div>
                <button onClick={stopTimer} disabled={saving}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50">
                  ⏹ Parar y guardar
                </button>
              </div>
            ) : (
              <div className="py-6 text-center text-gray-500">
                <div className="inline-flex h-12 w-12 rounded-full bg-gray-900 border border-gray-800 items-center justify-center text-gray-600 mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2"/><polyline points="12 6 12 12 16 14" strokeWidth="2"/></svg>
                </div>
                <h4 className="text-sm font-bold text-white">¿Qué vas a registrar, {empleadoNombre.split(' ')[0]}?</h4>
                <p className="text-xs text-gray-600 mt-1">Rellena el formulario e inicia el cronómetro o introduce el tiempo manualmente.</p>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">
              {modo === 'manual' ? 'Registro manual' : 'Iniciar tarea'}
            </h3>
            <button onClick={() => setModo(m => m === 'timer' ? 'manual' : 'timer')}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
              {modo === 'manual' ? '⏱️ Cronómetro' : '✏️ Manual'}
            </button>
          </div>

          {/* Descripcion */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">1. Tarea realizada *</label>
            <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Diseño de mockups, reunión cliente..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30" />
          </div>

          {/* Cliente + Departamento */}
          <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Cliente</label>
                <select value={clienteId} onChange={e => setClienteId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="">— Ninguno —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  <option value="__otros__">— Otros... —</option>
                </select>
                {clienteTieneProyectos() && (
                  <div className="mt-1.5 space-y-1.5">
                    <select value={proyectoOtrosId} onChange={e => setProyectoOtrosId(e.target.value)}
                      className="w-full bg-gray-800 border border-blue-500 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-400">
                      <option value="">— Selecciona proyecto —</option>
                      {serviciosDelCliente().map(s => (
                        <option key={s.id} value={s.id}>
                          {s.notas ?? s.nombre ?? s.id}
                        </option>
                      ))}
                      <option value="__manual__">✏️ Manual (escribir)</option>
                    </select>
                    {proyectoOtrosId === '__manual__' && (
                      <input type="text" value={proyectoOtrosManual} onChange={e => setProyectoOtrosManual(e.target.value)}
                        placeholder="Escribe el proyecto o tarea..."
                        className="w-full bg-gray-800 border border-blue-400 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-300" />
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Departamento</label>
                <select value={departamentoId} onChange={e => setDepartamentoId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="">— Ninguno —</option>
                  {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  <option value="__otros__">— Otros... —</option>
                </select>
                {(departamentoId === '__otros__' || departamentos.find(d => d.id === departamentoId)?.nombre?.toLowerCase() === 'otros') && (
                  <input type="text" value={departamentoOtros} onChange={e => setDepartamentoOtros(e.target.value)}
                    placeholder="Especifica el departamento..."
                    className="mt-1.5 w-full bg-gray-800 border border-blue-500 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-400" />
                )}
              </div>
            </div>

          {/* Timer action */}
          {modo === 'timer' && (
            <button onClick={startTimer} disabled={timerRunning || saving}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm tracking-wide uppercase transition-all ${
                timerRunning ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}>
              ▶ Iniciar cronómetro en vivo
            </button>
          )}

          {/* Manual fields */}
          {modo === 'manual' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Fecha</label>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Horas</label>
                  <input type="number" min="0" max="23" value={manualHoras} onChange={e => setManualHoras(e.target.value)} placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Minutos</label>
                  <input type="number" min="0" max="59" value={manualMin} onChange={e => setManualMin(e.target.value)} placeholder="30"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <button onClick={saveManual} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-colors disabled:opacity-50">
                {saving ? 'Guardando...' : '💾 Guardar registro manual'}
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      </div>

      {/* RIGHT: History */}
      <div className="lg:col-span-7">
        <HistorialPersonal
          clientes={clientes}
          departamentos={departamentos}
          onDelete={async (id) => { await fetch(`/api/time-logs?id=${id}`, { method: 'DELETE' }); onSaved() }} />
      </div>
    </div>
  )
}

// ─── HISTORIAL PERSONAL ───────────────────────────────────────────────────────
function HistorialPersonal({ onDelete, clientes, departamentos }: {
  onDelete: (id: string) => void
  clientes: Cliente[]
  departamentos: Departamento[]
}) {
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes' | 'custom'>('dia')
  const [customDesde, setCustomDesde] = useState(todayStr)
  const [customHasta, setCustomHasta] = useState(todayStr)
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editClienteId, setEditClienteId] = useState('')
  const [editDeptId, setEditDeptId] = useState('')
  const [editMinutos, setEditMinutos] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => { fetchLogs() }, [periodo, customDesde, customHasta]) // eslint-disable-line

  async function fetchLogs() {
    setLoading(true)
    try {
      const now = new Date()
      const mesStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
      const params = new URLSearchParams()
      if (periodo === 'mes') params.set('fecha', mesStr)
      if (periodo === 'custom') { params.set('desde', customDesde); params.set('hasta', customHasta) }
      params.set('mine', '1')
      const res = await fetch(`/api/time-logs?${params}`)
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }

  function startEdit(l: TimeLog) {
    setEditingId(l.id)
    setEditDesc(l.descripcion)
    setEditClienteId(l.cliente?.id ?? '')
    setEditDeptId(l.departamento?.id ?? '')
    setEditMinutos(String(l.minutos))
  }

  function cancelEdit() { setEditingId(null) }

  async function saveEdit(id: string) {
    setEditSaving(true)
    try {
      const res = await fetch(`/api/time-logs?id=${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion: editDesc, id_cliente: editClienteId || null, id_departamento: editDeptId || null, minutos: editMinutos }),
      })
      if (!res.ok) return
      setEditingId(null)
      await fetchLogs()
    } finally { setEditSaving(false) }
  }

  const filteredLogs = useMemo(() => {
    const today = todayStr()
    if (periodo === 'dia') return logs.filter(l => l.fecha === today)
    if (periodo === 'custom') return logs.filter(l => l.fecha >= customDesde && l.fecha <= customHasta)
    if (periodo === 'semana') {
      return logs.filter(l => {
        const diff = (new Date(today).getTime() - new Date(l.fecha).getTime()) / 86400000
        return diff >= 0 && diff <= 7
      })
    }
    return logs
  }, [logs, periodo, customDesde, customHasta])

  const totalMin = filteredLogs.reduce((s, l) => s + l.minutos, 0)
  const goalMin = periodo === 'dia' || periodo === 'custom' ? 480 : periodo === 'semana' ? 2400 : 9600
  const goalLabel = periodo === 'dia' || periodo === 'custom' ? 'Meta: 8h' : periodo === 'semana' ? 'Meta: 40h' : 'Meta: 160h'
  const pct = Math.min(100, Math.round((totalMin / goalMin) * 100))

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-gray-800 pb-4 mb-4">
        <div>
          <p className="text-xs font-extrabold text-blue-400 uppercase tracking-widest">Mi resumen de jornada</p>
          <h3 className="text-lg font-black text-white mt-0.5">Control de tiempos</h3>
          <p className="text-xs text-gray-500 mt-1">Consulta tu historial por día, semana o mes.</p>
        </div>
      </div>

      {/* Period tabs */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex bg-gray-800 rounded-xl p-1 gap-0.5">
            {(['dia','semana','mes','custom'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                  periodo === p ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'
                }`}>
                {p === 'dia' ? 'Hoy' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mes' : 'Día'}
              </button>
            ))}
          </div>
          {periodo === 'custom' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Desde</span>
                <input type="date" value={customDesde} onChange={e => setCustomDesde(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Hasta</span>
                <input type="date" value={customHasta} onChange={e => setCustomHasta(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-5 flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/15 rounded-xl text-blue-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2"/><polyline points="12 6 12 12 16 14" strokeWidth="2"/></svg>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">Registrado</span>
              <span className="font-mono text-2xl font-black text-white">{fmtMin(totalMin)}</span>
              <span className="text-gray-500 text-xs block">{goalLabel}</span>
            </div>
          </div>
          <div className="col-span-7 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-gray-400">Dedicación</span>
              <span className="text-blue-400 font-extrabold bg-blue-500/10 px-2 py-0.5 rounded-full">{pct}% completado</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-700 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[10px] text-gray-500 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {pct >= 100 ? '¡Meta alcanzada!' : `Faltan ${((Math.max(0, goalMin - totalMin)) / 60).toFixed(1)}h para completar el periodo`}
            </p>
          </div>
        </div>

        {/* Log list */}
        <div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-3">Detalle de fichajes</span>
          {loading ? (
            <p className="text-gray-500 text-sm py-10 text-center">Cargando...</p>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 border border-dashed border-gray-700 rounded-2xl text-center text-gray-500">
              <p className="text-sm font-bold text-gray-400">Sin registros en este periodo</p>
              <p className="text-xs text-gray-600 mt-1">Inicia el cronómetro o añade tiempo manual.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredLogs.map(l => (
                <div key={l.id} className="p-3.5 rounded-xl border border-gray-800 hover:border-gray-700 hover:bg-gray-800/30 transition-all">
                  {editingId === l.id ? (
                    <div className="space-y-2">
                      <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" />
                      <div className="grid grid-cols-2 gap-2">
                        <select value={editClienteId} onChange={e => setEditClienteId(e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500">
                          <option value="">— Sin cliente —</option>
                          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                        <select value={editDeptId} onChange={e => setEditDeptId(e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500">
                          <option value="">— Sin depto —</option>
                          {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" value={editMinutos} onChange={e => setEditMinutos(e.target.value)}
                          className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500" />
                        <span className="text-xs text-gray-500">min</span>
                        <button onClick={() => saveEdit(l.id)} disabled={editSaving}
                          className="ml-auto text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          ✓ Guardar
                        </button>
                        <button onClick={cancelEdit}
                          className="text-xs font-bold bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                          ✕ Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{l.descripcion}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500">
                          {l.cliente?.nombre && (
                            <span className="bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full text-gray-300">{l.cliente.nombre}</span>
                          )}
                          {l.departamento?.nombre && (
                            <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{l.departamento.nombre}</span>
                          )}
                          <span className="font-mono text-gray-600">{new Date(l.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'short' })}</span>
                          {l.hora_inicio && <span className="font-mono text-gray-600">{l.hora_inicio}–{l.hora_fin}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-sm font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">{fmtMin(l.minutos)}</span>
                        <button onClick={() => startEdit(l)} className="text-gray-700 hover:text-blue-400 p-1 rounded-lg hover:bg-blue-500/10 transition-colors" title="Editar">✏️</button>
                        <button onClick={() => onDelete(l.id)} className="text-gray-700 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-colors" title="Eliminar">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Privacy note */}
        <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/15 text-xs flex gap-2">
          <span className="text-blue-400 shrink-0 mt-0.5">🔒</span>
          <p className="text-gray-400">Solo ves tus propios fichajes. Tus datos están protegidos conforme a la normativa laboral vigente.</p>
        </div>
      </div>
    </div>
  )
}

// ─── ADMIN ANALYSIS ───────────────────────────────────────────────────────────
function AdminAnalysis({ empleados }: { empleados: Empleado[] }) {
  const [tab, setTab] = useState<'persona' | 'proyecto' | 'resumen'>('persona')
  const [periodo, setPeriodo] = useState<'todo' | 'hoy' | 'semana' | 'mes'>('mes')
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmp, setSelectedEmp] = useState<string | null>(empleados[0]?.id ?? null)
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ descripcion: '', minutos: '' })

  useEffect(() => { fetchLogs() }, [periodo]) // eslint-disable-line

  async function fetchLogs() {
    setLoading(true)
    try {
      const now = new Date()
      const params = new URLSearchParams()
      if (periodo === 'mes') params.set('fecha', `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
      const res = await fetch(`/api/time-logs?${params}`)
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }

  function startEdit(l: TimeLog) {
    setEditingId(l.id)
    setEditForm({ descripcion: l.descripcion, minutos: String(l.minutos) })
  }

  async function saveEdit(id: string) {
    const mins = parseInt(editForm.minutos)
    if (!editForm.descripcion.trim() || isNaN(mins) || mins <= 0) return
    await fetch(`/api/time-logs?id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion: editForm.descripcion, minutos: mins }),
    })
    setEditingId(null)
    fetchLogs()
  }

  const filteredLogs = useMemo(() => {
    const today = todayStr()
    if (periodo === 'hoy') return logs.filter(l => l.fecha === today)
    if (periodo === 'semana') return logs.filter(l => {
      const diff = (new Date(today).getTime() - new Date(l.fecha).getTime()) / 86400000
      return diff >= 0 && diff <= 7
    })
    return logs
  }, [logs, periodo])

  const totalMin = filteredLogs.reduce((s, l) => s + l.minutos, 0)

  // By employee
  const byEmp = useMemo(() => {
    const map = new Map<string, { nombre: string; minutos: number; clientes: Map<string, number>; deptos: Map<string, number> }>()
    for (const l of filteredLogs) {
      const empId = l.id_empleado
      const nombre = l.empleado?.nombre ?? empId
      if (!map.has(empId)) map.set(empId, { nombre, minutos: 0, clientes: new Map(), deptos: new Map() })
      const e = map.get(empId)!
      e.minutos += l.minutos
      if (l.cliente?.nombre) e.clientes.set(l.cliente.nombre, (e.clientes.get(l.cliente.nombre) ?? 0) + l.minutos)
      if (l.departamento?.nombre) e.deptos.set(l.departamento.nombre, (e.deptos.get(l.departamento.nombre) ?? 0) + l.minutos)
    }
    return Array.from(map.values()).sort((a, b) => b.minutos - a.minutos)
  }, [filteredLogs])

  // By cliente
  const byCliente = useMemo(() => {
    const map = new Map<string, { minutos: number; empleados: Map<string, number>; deptos: Map<string, number> }>()
    for (const l of filteredLogs) {
      const nombre = l.cliente?.nombre ?? 'Sin cliente'
      if (!map.has(nombre)) map.set(nombre, { minutos: 0, empleados: new Map(), deptos: new Map() })
      const c = map.get(nombre)!
      c.minutos += l.minutos
      const empNombre = l.empleado?.nombre ?? l.id_empleado
      c.empleados.set(empNombre, (c.empleados.get(empNombre) ?? 0) + l.minutos)
      if (l.departamento?.nombre) c.deptos.set(l.departamento.nombre, (c.deptos.get(l.departamento.nombre) ?? 0) + l.minutos)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].minutos - a[1].minutos)
  }, [filteredLogs])

  const selEmpData = byEmp.find(e => e.nombre === empleados.find(x => x.id === selectedEmp)?.nombre)
  const selClienteData = selectedCliente ? byCliente.find(([n]) => n === selectedCliente)?.[1] : null

  const COLORS = ['#6366f1','#06b6d4','#d946ef','#f59e0b','#10b981','#ef4444','#8b5cf6','#f97316']

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex bg-gray-800 rounded-xl p-1 gap-0.5">
          {(['persona','proyecto','resumen'] as const).map((t, i) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                tab === t ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {['👤','💼','📊'][i]} {['Por persona','Por proyecto','Resumen'][i]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Periodo:</span>
          <div className="flex bg-gray-800 border border-gray-700 rounded-lg p-0.5">
            {(['todo','hoy','semana','mes'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  periodo === p ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'
                }`}>
                {p === 'todo' ? 'Todo' : p === 'hoy' ? 'Hoy' : p === 'semana' ? '7 días' : 'Mes'}
              </button>
            ))}
          </div>
          <button onClick={fetchLogs} className="text-xs text-gray-500 hover:text-white transition-colors">↻</button>
        </div>
      </div>

      {loading ? <p className="text-gray-500 text-sm py-10 text-center">Cargando...</p> : (
        <>
          {/* BY PERSON */}
          {tab === 'persona' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-1">Tiempo por persona</h3>
                <p className="text-xs text-gray-500 mb-5">Selecciona un empleado para ver su desglose detallado.</p>
                <div className="space-y-3">
                  {byEmp.length === 0 ? <p className="text-gray-500 text-sm py-6 text-center">Sin datos en este periodo</p> : byEmp.map((e, i) => {
                    const pct = totalMin > 0 ? (e.minutos / totalMin) * 100 : 0
                    const isSelected = empleados.find(x => x.id === selectedEmp)?.nombre === e.nombre
                    return (
                      <div key={e.nombre} onClick={() => setSelectedEmp(empleados.find(x => x.nombre === e.nombre)?.id ?? null)}
                        className={`flex items-center justify-between gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${isSelected ? 'border-blue-500 bg-blue-500/5 shadow-lg' : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/30'}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                            {e.nombre.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-white truncate">{e.nombre}</p>
                              <span className="font-mono text-sm font-bold text-white ml-3">{fmtMin(e.minutos)}</span>
                            </div>
                            <div className="mt-2 h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct || 2}%`, backgroundColor: isSelected ? '#6366f1' : COLORS[i % COLORS.length] + '99' }} />
                            </div>
                          </div>
                        </div>
                        <span className={`text-gray-600 transition-transform ${isSelected ? 'text-blue-400 translate-x-1' : ''}`}>›</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="lg:col-span-5 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
                {selEmpData ? (
                  <>
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-800 mb-4">
                      <div className="h-14 w-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0 bg-blue-600">
                        {selEmpData.nombre.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest">Análisis</p>
                        <h4 className="text-base font-bold text-white">{selEmpData.nombre}</h4>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total</p>
                        <p className="font-mono text-lg font-black text-white mt-1">{fmtMin(selEmpData.minutos)}</p>
                      </div>
                      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Clientes</p>
                        <p className="font-mono text-lg font-black text-white mt-1">{selEmpData.clientes.size}</p>
                      </div>
                    </div>
                    {selEmpData.clientes.size > 0 && (
                      <>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Por cliente</p>
                        <div className="space-y-3 flex-1 overflow-y-auto">
                          {Array.from(selEmpData.clientes.entries()).sort((a,b) => b[1]-a[1]).map(([nombre, mins], i) => {
                            const p = selEmpData.minutos > 0 ? (mins / selEmpData.minutos) * 100 : 0
                            return (
                              <div key={nombre}>
                                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                                  <span className="flex items-center gap-1.5 text-gray-300">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    {nombre}
                                  </span>
                                  <span className="font-mono text-white">{fmtMin(mins)} <span className="text-gray-500">({p.toFixed(0)}%)</span></span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-gray-700">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-600">
                    <p className="text-sm">Selecciona un empleado</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BY PROJECT */}
          {tab === 'proyecto' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-1">Tiempo por proyecto</h3>
                <p className="text-xs text-gray-500 mb-5">Selecciona un cliente para ver quién ha trabajado en él.</p>
                <div className="space-y-3">
                  {byCliente.length === 0 ? <p className="text-gray-500 text-sm py-6 text-center">Sin datos en este periodo</p> : byCliente.map(([nombre, data], i) => {
                    const pct = totalMin > 0 ? (data.minutos / totalMin) * 100 : 0
                    const isSelected = selectedCliente === nombre
                    return (
                      <div key={nombre} onClick={() => setSelectedCliente(nombre)}
                        className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${isSelected ? 'border-blue-500 bg-blue-500/5' : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/30'}`}>
                        <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white text-base font-bold shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                          {nombre.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold text-white truncate">{nombre}</p>
                            <span className="font-mono text-sm font-bold text-white ml-2">{fmtMin(data.minutos)}</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct || 2}%`, backgroundColor: isSelected ? '#6366f1' : COLORS[i % COLORS.length] + '99' }} />
                          </div>
                        </div>
                        <span className={`text-gray-600 ${isSelected ? 'text-blue-400' : ''}`}>›</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="lg:col-span-5 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
                {selClienteData && selectedCliente ? (
                  <>
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-800 mb-4">
                      <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0 bg-blue-600">
                        {selectedCliente.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest">Proyecto</p>
                        <h4 className="text-lg font-bold text-white">{selectedCliente}</h4>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Total horas</p>
                        <p className="font-mono text-lg font-black text-white mt-1">{fmtMin(selClienteData.minutos)}</p>
                      </div>
                      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Personas</p>
                        <p className="font-mono text-lg font-black text-white mt-1">{selClienteData.empleados.size}</p>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Por empleado</p>
                    <div className="space-y-3 flex-1 overflow-y-auto">
                      {Array.from(selClienteData.empleados.entries()).sort((a,b) => b[1]-a[1]).map(([nombre, mins], i) => {
                        const p = selClienteData.minutos > 0 ? (mins / selClienteData.minutos) * 100 : 0
                        return (
                          <div key={nombre}>
                            <div className="flex items-center justify-between text-xs font-semibold mb-1">
                              <span className="flex items-center gap-2 text-gray-300">
                                <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: COLORS[i % COLORS.length] }}>{nombre.charAt(0)}</div>
                                {nombre}
                              </span>
                              <span className="font-mono text-white">{fmtMin(mins)} <span className="text-gray-500">({p.toFixed(0)}%)</span></span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-gray-700">
                              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${p}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-600">
                    <p className="text-sm">Selecciona un proyecto</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RESUMEN */}
          {tab === 'resumen' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Mayor aporte', icon: '📈', value: byEmp[0]?.nombre ?? '—', sub: byEmp[0] ? fmtMin(byEmp[0].minutos) : '' },
                  { label: 'Proyecto más activo', icon: '💼', value: byCliente[0]?.[0] ?? '—', sub: byCliente[0] ? fmtMin(byCliente[0][1].minutos) : '' },
                  { label: 'Total equipo', icon: '⏱️', value: fmtMin(totalMin), sub: `${filteredLogs.length} registros` },
                ].map(card => (
                  <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      <span>{card.icon}</span>{card.label}
                    </div>
                    <h4 className="text-lg font-black text-white">{card.value}</h4>
                    {card.sub && <p className="text-xs text-gray-500 font-mono mt-1">{card.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Dept breakdown */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-5">Distribución por departamento</h3>
                <div className="space-y-4">
                  {(() => {
                    const deptMap = new Map<string, number>()
                    filteredLogs.forEach(l => { if (l.departamento?.nombre) deptMap.set(l.departamento.nombre, (deptMap.get(l.departamento.nombre) ?? 0) + l.minutos) })
                    const total = Array.from(deptMap.values()).reduce((a,b) => a+b, 0)
                    if (total === 0) return <p className="text-gray-500 text-sm py-6 text-center">Sin datos</p>
                    return Array.from(deptMap.entries()).sort((a,b) => b[1]-a[1]).map(([name, mins], i) => {
                      const p = (mins / total) * 100
                      return (
                        <div key={name} className="flex flex-col md:flex-row md:items-center gap-3 border-b border-gray-800/50 pb-3">
                          <div className="md:w-1/3">
                            <p className="text-xs font-bold text-white">{name}</p>
                          </div>
                          <div className="flex-1 flex items-center gap-4">
                            <div className="flex-1 h-3 bg-gray-700 rounded-lg overflow-hidden">
                              <div className="h-full rounded-lg transition-all duration-700" style={{ width: `${p}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                            </div>
                            <span className="font-mono text-xs font-bold text-white w-16 text-right">{fmtMin(mins)}</span>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>

              {/* Full team log */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800">
                  <h3 className="text-white font-semibold">Registro completo del equipo</h3>
                  <p className="text-gray-500 text-xs mt-0.5">{filteredLogs.length} entradas</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                        <th className="text-left px-6 py-3">Fecha</th>
                        <th className="text-left px-4 py-3">Empleado</th>
                        <th className="text-left px-4 py-3">Tarea</th>
                        <th className="text-left px-4 py-3">Cliente</th>
                        <th className="text-right px-4 py-3">Tiempo</th>
                        <th className="px-4 py-3 w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.slice(0, 50).map(l => (
                        <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="px-6 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                            {new Date(l.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'short' })}
                          </td>
                          <td className="px-4 py-2.5 text-white text-sm">{l.empleado?.nombre ?? '—'}</td>
                          <td className="px-4 py-2.5 text-gray-300 max-w-[200px]">
                            {editingId === l.id ? (
                              <input value={editForm.descripcion} onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))}
                                className="w-full bg-gray-800 border border-blue-500 rounded px-2 py-1 text-white text-xs focus:outline-none" />
                            ) : (
                              <span className="truncate block" title={l.descripcion}>{l.descripcion}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs">{l.cliente?.nombre ?? '—'}</td>
                          <td className="px-4 py-2.5 text-right">
                            {editingId === l.id ? (
                              <input type="number" value={editForm.minutos} onChange={e => setEditForm(f => ({ ...f, minutos: e.target.value }))}
                                className="w-16 bg-gray-800 border border-blue-500 rounded px-2 py-1 text-white text-xs text-right focus:outline-none" />
                            ) : (
                              <span className="text-blue-400 font-mono font-medium">{fmtMin(l.minutos)}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {editingId === l.id ? (
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => saveEdit(l.id)} className="text-green-400 hover:text-green-300 text-xs font-bold px-2 py-1 rounded bg-green-500/10 hover:bg-green-500/20 transition-colors">✓</button>
                                <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700 transition-colors">✕</button>
                              </div>
                            ) : (
                              <button onClick={() => startEdit(l)} className="text-gray-600 hover:text-blue-400 transition-colors" title="Editar">✏️</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function FicharClient({ perfil, empleadoNombre, servicios, departamentos, clientes, empleados }: Props) {
  const [tab, setTab] = useState<'fichar' | 'analisis'>('fichar')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-extrabold text-blue-400 uppercase tracking-widest">Siana Digital CRM</p>
          <h2 className="text-2xl font-black text-white mt-0.5">
            {perfil.rol === 'admin' ? 'Panel de tiempos' : 'Mi workspace de tiempos'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {empleadoNombre} ·{' '}
            <span className={`font-semibold ${perfil.rol === 'admin' ? 'text-blue-400' : 'text-green-400'}`}>
              {perfil.rol === 'admin' ? '⚙️ Admin' : '👤 Empleado'}
            </span>
          </p>
        </div>
        {perfil.rol === 'admin' && (
          <div className="flex gap-2">
            {(['fichar','analisis'] as const).map((t, i) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {['⏱️ Fichar','📊 Análisis equipo'][i]}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'fichar' && (
        <TabFichar key={refreshKey} perfil={perfil} empleadoNombre={empleadoNombre}
          servicios={servicios} departamentos={departamentos} clientes={clientes}
          onSaved={() => setRefreshKey(k => k + 1)} />
      )}
      {tab === 'analisis' && perfil.rol === 'admin' && (
        <AdminAnalysis empleados={empleados} />
      )}
    </div>
  )
}
