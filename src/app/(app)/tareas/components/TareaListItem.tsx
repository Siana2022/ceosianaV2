'use client'

import { useTareas } from '../store'
import { formatFecha } from '../dateUtils'
import { RECURRENCIA_LABEL, TIPO_TAREA_ICONO } from '../mockData'
import type { Tarea } from '../types'
import EstadoTareaSelect from './EstadoTareaSelect'
import { useTimerTarea } from './useTimerTarea'

function formatMinutos(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return h > 0 ? `${h}h ${min}m` : `${min}m`
}

export default function TareaListItem({ tarea, onAbrir }: { tarea: Tarea; onAbrir: () => void }) {
  const { actions } = useTareas()
  const { toggleTimer, loading, timerError } = useTimerTarea()

  return (
    <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2 transition-colors">
      <button onClick={onAbrir} className="flex-1 min-w-0 text-left text-white text-sm truncate hover:text-blue-300">
        {TIPO_TAREA_ICONO[tarea.tipo]} {tarea.nombre}
        {tarea.recurrencia !== 'ninguna' && <span className="text-purple-400 ml-1.5 text-xs">🔁 {RECURRENCIA_LABEL[tarea.recurrencia]}</span>}
      </button>
      <span className="text-gray-500 text-xs w-28 truncate hidden sm:inline flex-shrink-0">🏢 {actions.nombreCliente(tarea.idCliente)}</span>
      <span className="text-gray-500 text-xs w-24 truncate hidden md:inline flex-shrink-0">👤 {actions.nombresEmpleados(tarea.idsResponsables)}</span>
      <span className="text-gray-500 text-xs w-24 truncate hidden lg:inline flex-shrink-0">🗂️ {actions.nombreDepartamento(tarea.idDepartamento)}</span>
      <span className="text-gray-500 text-xs w-20 flex-shrink-0">📅 {formatFecha(tarea.fechaLimite)}{tarea.hora && ` ${tarea.hora}`}</span>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <button
          onClick={e => toggleTimer(tarea, e)}
          disabled={loading}
          title={timerError ?? undefined}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-opacity ${loading ? 'opacity-50 cursor-wait' : ''} ${timerError ? 'ring-1 ring-red-500' : ''} ${tarea.timerActivo ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-300'}`}
        >
          {loading ? '⏳' : tarea.timerActivo ? '⏸' : '▶'} {formatMinutos(tarea.minutosAcumulados)}
        </button>
        {timerError && <span className="text-red-400 text-xs leading-tight max-w-32 truncate">{timerError}</span>}
      </div>
      <EstadoTareaSelect tarea={tarea} onRequiereExplicacion={onAbrir} />
    </div>
  )
}
