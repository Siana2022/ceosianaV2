'use client'

import { useTareas } from '../store'
import { calcularEstadoTiempoFase, formatFecha } from '../dateUtils'
import type { Proceso, ProcesoFase } from '../types'
import EstadoBadge from './EstadoBadge'

function formatMinutos(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return h > 0 ? `${h}h ${min}m` : `${min}m`
}

interface Props {
  proceso: Proceso
  fase: ProcesoFase
  onAbrir: () => void
  esPrimera?: boolean
  esUltima?: boolean
}

export default function FaseCard({ proceso, fase, onAbrir, esPrimera, esUltima }: Props) {
  const { actions } = useTareas()
  const bloqueadaPorAnterior = fase.estado === 'espera'
  const estadoTiempo = calcularEstadoTiempoFase(fase)

  return (
    <div className={`w-64 flex-shrink-0 bg-gray-900 border rounded-xl p-4 space-y-3 ${fase.estado === 'proceso' ? 'border-blue-700/60' : 'border-gray-800'}`}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-white font-medium text-sm leading-snug">{fase.nombre}</h4>
        <EstadoBadge estado={fase.estado} tipo="fase" />
      </div>

      {(esPrimera !== undefined || esUltima !== undefined) && (
        <div className="flex items-center gap-1.5 -mt-1">
          <span className="text-gray-600 text-[10px] uppercase tracking-wide">Orden</span>
          <button
            onClick={() => actions.moverFaseProceso(proceso.id, fase.id, -1)}
            disabled={esPrimera}
            title="Mover antes"
            className="w-6 h-6 flex items-center justify-center rounded border border-gray-700 bg-gray-800 hover:bg-gray-700 hover:border-gray-600 text-gray-300 text-xs disabled:opacity-25 disabled:hover:bg-gray-800"
          >
            ▲
          </button>
          <button
            onClick={() => actions.moverFaseProceso(proceso.id, fase.id, 1)}
            disabled={esUltima}
            title="Mover después"
            className="w-6 h-6 flex items-center justify-center rounded border border-gray-700 bg-gray-800 hover:bg-gray-700 hover:border-gray-600 text-gray-300 text-xs disabled:opacity-25 disabled:hover:bg-gray-800"
          >
            ▼
          </button>
        </div>
      )}

      <div className="text-xs text-gray-400 space-y-1">
        <p>🏢 {actions.nombreCliente(proceso.idCliente)}</p>
        <p>👤 {actions.nombresEmpleados(fase.idsResponsables)}</p>
        <p>🗂️ {actions.nombreDepartamento(fase.idDepartamento)}</p>
        <p>📅 {formatFecha(fase.fechaInicioPrevista)} → {formatFecha(fase.fechaFinPrevista)}</p>
        {estadoTiempo && (
          <p className={estadoTiempo === 'en_tiempo' ? 'text-green-400' : 'text-red-400'}>
            {estadoTiempo === 'en_tiempo' ? '🟢 En tiempo' : '🔴 Vas con retraso'}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-800 pt-2">
        <button
          onClick={() => actions.toggleTimerFase(proceso.id, fase.id)}
          disabled={bloqueadaPorAnterior}
          className={`flex items-center gap-1 rounded px-2 py-1 disabled:opacity-40 ${fase.timerActivo ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-300'}`}
        >
          {fase.timerActivo ? '⏸' : '▶'} {formatMinutos(fase.minutosAcumulados)}
        </button>
        <span title="Adjuntos">📎 {fase.adjuntos.length}</span>
        <span title="Mensajes">💬 {fase.chat.length}</span>
      </div>

      <div className="flex gap-2">
        <button onClick={onAbrir} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg py-1.5 text-xs font-medium">
          Ver detalle
        </button>
        {fase.estado !== 'terminado' && (
          <button
            onClick={() => actions.marcarFaseTerminada(proceso.id, fase.id)}
            disabled={bloqueadaPorAnterior}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-30 disabled:hover:bg-green-600 text-white rounded-lg py-1.5 text-xs font-medium"
          >
            Marcar terminado
          </button>
        )}
      </div>
    </div>
  )
}
