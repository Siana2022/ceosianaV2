'use client'

import { useTareas } from '../store'
import { RECURRENCIA_LABEL, TIPO_TAREA_ICONO } from '../mockData'
import { formatFecha } from '../dateUtils'
import type { Tarea } from '../types'
import EstadoTareaSelect from './EstadoTareaSelect'
import { useTimerTarea } from './useTimerTarea'

function formatMinutos(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return h > 0 ? `${h}h ${min}m` : `${min}m`
}

export default function TareaCard({ tarea, onAbrir }: { tarea: Tarea; onAbrir: () => void }) {
  const { actions } = useTareas()
  const { toggleTimer, loading, timerError } = useTimerTarea()

  return (
    <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 space-y-3 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-white font-medium text-sm">{TIPO_TAREA_ICONO[tarea.tipo]} {tarea.nombre}</h4>
        <EstadoTareaSelect tarea={tarea} onRequiereExplicacion={onAbrir} />
      </div>

      <div className="text-xs text-gray-400 space-y-1">
        <p>🏢 {actions.nombreCliente(tarea.idCliente)}</p>
        <p>👤 {actions.nombresEmpleados(tarea.idsResponsables)}</p>
        <p>🗂️ {actions.nombreDepartamento(tarea.idDepartamento)}</p>
        <p>
          📅 {formatFecha(tarea.fechaLimite)}{tarea.hora && ` · ${tarea.hora}`}
          {tarea.recurrencia !== 'ninguna' && (
            <span className="text-purple-400 ml-2">🔁 {RECURRENCIA_LABEL[tarea.recurrencia]}</span>
          )}
        </p>
        {tarea.lugar && <p className="truncate">📍 {tarea.lugar}</p>}
      </div>

      {tarea.estado === 'bloqueada' && tarea.explicacionBloqueo && (
        <p className="text-red-400 text-xs bg-red-500/10 rounded px-2 py-1">⚠️ {tarea.explicacionBloqueo}</p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-800 pt-2">
        <div className="flex flex-col gap-1">
          <button
            onClick={e => toggleTimer(tarea, e)}
            disabled={loading}
            className={`flex items-center gap-1 rounded px-2 py-1 transition-opacity ${loading ? 'opacity-50 cursor-wait' : ''} ${tarea.timerActivo ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-300'}`}
          >
            {loading ? '⏳' : tarea.timerActivo ? '⏸' : '▶'} {formatMinutos(tarea.minutosAcumulados)}
          </button>
          {timerError && <span className="text-red-400 text-xs leading-tight">{timerError}</span>}
        </div>
        <span title="Adjuntos">📎 {tarea.adjuntos.length}</span>
        <span title="Mensajes">💬 {tarea.chat.length}</span>
      </div>

      <button onClick={onAbrir} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg py-1.5 text-xs font-medium">
        Ver detalle
      </button>
    </div>
  )
}
