'use client'

import { useEffect, useState, useCallback } from 'react'

interface TimerActivo {
  id: string
  descripcion: string
  hora_inicio: string | null
  fecha: string
  empleado: { id: string; nombre: string } | null
  cliente: { id: string; nombre: string } | null
  departamento: { id: string; nombre: string } | null
}

interface EmpleadoDB {
  id: string
  nombre: string
}

function fmtElapsed(horaInicio: string | null, fecha: string): string {
  if (!horaInicio) return '—'
  const [hh, mm] = horaInicio.split(':').map(Number)
  const start = new Date(`${fecha}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`)
  const diffMs = Date.now() - start.getTime()
  if (diffMs < 0) return '—'
  const totalMin = Math.floor(diffMs / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const AVATAR_COLORS = [
  '#6366f1','#06b6d4','#d946ef','#f59e0b','#10b981','#ef4444','#8b5cf6','#f97316',
  '#0ea5e9','#84cc16','#ec4899','#14b8a6',
]

export default function EnVivoPage() {
  const [timers, setTimers] = useState<TimerActivo[]>([])
  const [empleados, setEmpleados] = useState<EmpleadoDB[]>([])
  const [tick, setTick] = useState(0)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [timersRes, empRes] = await Promise.all([
        fetch('/api/time-logs?activos=1'),
        fetch('/api/empleados'),
      ])
      if (timersRes.ok) setTimers(await timersRes.json())
      if (empRes.ok) {
        const data = await empRes.json()
        setEmpleados(Array.isArray(data) ? data : [])
      }
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount and every 30s
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Tick every second to update elapsed times
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Build map: empId → timer más reciente (primera escritura gana, API viene DESC)
  const timerByEmp = new Map<string, TimerActivo>()
  for (const t of timers) {
    if (t.empleado?.id && !timerByEmp.has(t.empleado.id)) {
      timerByEmp.set(t.empleado.id, t)
    }
  }

  const activos = empleados.filter(e => timerByEmp.has(e.id))
  const libres = empleados.filter(e => !timerByEmp.has(e.id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold text-white">
            {activos.length} {activos.length === 1 ? 'persona trabajando' : 'personas trabajando'} ahora mismo
          </span>
          {lastRefresh && (
            <span className="text-xs text-gray-600">
              · actualizado {lastRefresh.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
        <button
          onClick={fetchData}
          className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-800 hover:border-gray-600"
        >
          ↻ Actualizar
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-500 text-sm">Cargando...</div>
      ) : (
        <>
          {/* Active employees */}
          {activos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {activos.map((emp, i) => {
                const timer = timerByEmp.get(emp.id)!
                const elapsed = fmtElapsed(timer.hora_inicio, timer.fecha)
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
                return (
                  <div key={emp.id} className="rounded-2xl border border-green-500/25 bg-green-500/5 p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {emp.nombre.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{emp.nombre}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs text-green-400 font-semibold">{elapsed}</span>
                          {timer.hora_inicio && (
                            <span className="text-xs text-gray-600">desde {timer.hora_inicio}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/30 border border-gray-800 rounded-xl p-3 space-y-2">
                      <p className="text-sm font-semibold text-white leading-tight">{timer.descripcion || '—'}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {timer.cliente && (
                          <span className="text-[10px] font-semibold bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                            {timer.cliente.nombre}
                          </span>
                        )}
                        {timer.departamento && (
                          <span className="text-[10px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                            {timer.departamento.nombre}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Free employees */}
          {libres.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Sin timer activo</p>
              <div className="flex flex-wrap gap-2">
                {libres.map((emp, i) => {
                  const color = AVATAR_COLORS[(activos.length + i) % AVATAR_COLORS.length]
                  return (
                    <div key={emp.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-800 bg-gray-900/50">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 opacity-50"
                        style={{ backgroundColor: color }}
                      >
                        {emp.nombre.charAt(0)}
                      </div>
                      <span className="text-xs text-gray-500 font-medium">{emp.nombre}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activos.length === 0 && libres.length === 0 && (
            <div className="py-20 text-center text-gray-500 text-sm">No hay empleados activos</div>
          )}
        </>
      )}

      {/* hidden tick consumer to trigger re-render */}
      <span className="hidden">{tick}</span>
    </div>
  )
}
