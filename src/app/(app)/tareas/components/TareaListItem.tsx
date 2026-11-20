'use client'

import { useEffect, useState } from 'react'
import { useTareas } from '../store'
import { formatFecha } from '../dateUtils'
import { RECURRENCIA_LABEL, TIPO_TAREA_ICONO } from '../mockData'
import type { Tarea } from '../types'
import EstadoTareaSelect from './EstadoTareaSelect'
import { useTimerTarea } from './useTimerTarea'
import { TIMER_KEY } from '../constants'

function formatTiempo(minutos: number, extraSec: number) {
  const total = minutos + Math.floor(extraSec / 60)
  const sec = extraSec % 60
  const h = Math.floor(total / 60)
  const m = total % 60
  if (extraSec > 0) return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function TareaListItem({ tarea, onAbrir }: { tarea: Tarea; onAbrir: () => void }) {
  const { state, actions } = useTareas()
  const { toggleTimer, loading, timerError } = useTimerTarea()
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => {
    if (!tarea.timerActivo) { setElapsedSec(0); return }
    try {
      const saved = localStorage.getItem(TIMER_KEY)
      if (!saved) return
      const { startTs, tareaId } = JSON.parse(saved)
      if (tareaId !== tarea.id || !startTs) return
      const update = () => setElapsedSec(Math.floor((Date.now() - startTs) / 1000))
      update()
      const id = setInterval(update, 1000)
      return () => clearInterval(id)
    } catch {}
  }, [tarea.timerActivo, tarea.id])

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_10rem_10rem_7rem_9rem_7rem_8rem] items-center gap-3 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2 transition-colors">
      <button onClick={onAbrir} className="min-w-0 text-left text-white text-sm hover:text-blue-300 truncate whitespace-nowrap py-0.5">
        {TIPO_TAREA_ICONO[tarea.tipo]} {tarea.nombre}
        {tarea.recurrencia !== 'ninguna' && <span className="text-purple-400 ml-1.5 text-xs">🔁 {RECURRENCIA_LABEL[tarea.recurrencia]}</span>}
      </button>
      <span className="text-gray-500 text-xs truncate text-left">🏢 {actions.nombreCliente(tarea.idCliente)}</span>
      <span className="text-gray-500 text-xs flex items-center justify-start gap-1 min-w-0">
        {tarea.idsResponsables.slice(0, 2).map(id => {
          const emp = state.empleados.find(e => e.id === id)
          if (!emp) return null
          return emp.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img key={id} src={emp.avatarUrl} alt={emp.nombre} title={emp.nombre} className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
            : <span key={id} title={emp.nombre} className="w-4 h-4 rounded-full bg-gray-700 text-[9px] text-gray-300 flex items-center justify-center flex-shrink-0">{emp.nombre[0]}</span>
        })}
        <span className="truncate">👤 {actions.nombresEmpleados(tarea.idsResponsables)}</span>
      </span>
      <span className="text-gray-500 text-xs truncate text-left">🗂️ {actions.nombreDepartamento(tarea.idDepartamento)}</span>
      <span className="text-gray-500 text-xs whitespace-nowrap text-center">📅 {formatFecha(tarea.fechaLimite)}{tarea.hora && ` · ${tarea.hora}`}</span>
      <div className="flex flex-col items-end gap-0.5 min-w-0">
        <button
          onClick={e => toggleTimer(tarea, e)}
          disabled={loading}
          title={timerError ?? undefined}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-opacity ${loading ? 'opacity-50 cursor-wait' : ''} ${timerError ? 'ring-1 ring-red-500' : ''} ${tarea.timerActivo ? 'bg-red-500/20 text-red-400 font-mono' : 'bg-gray-800 text-gray-300'}`}
        >
          {loading ? '⏳' : tarea.timerActivo ? '⏸' : '▶'} {formatTiempo(tarea.minutosAcumulados, tarea.timerActivo ? elapsedSec : 0)}
        </button>
        {timerError && <span className="text-red-400 text-xs leading-tight max-w-32 truncate">{timerError}</span>}
      </div>
      <EstadoTareaSelect tarea={tarea} onRequiereExplicacion={onAbrir} />
    </div>
  )
}
