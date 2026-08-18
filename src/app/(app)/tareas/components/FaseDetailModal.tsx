'use client'

import { useState } from 'react'
import { useTareas } from '../store'
import { calcularEstadoTiempoFase } from '../dateUtils'
import type { Proceso, ProcesoFase } from '../types'
import EstadoBadge from './EstadoBadge'
import ChatMock from './ChatMock'
import ResponsablesMultiSelect from './ResponsablesMultiSelect'

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

function formatMinutos(m: number) {
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

export default function FaseDetailModal({ proceso, fase, onClose }: { proceso: Proceso; fase: ProcesoFase; onClose: () => void }) {
  const { state, actions } = useTareas()
  const [nuevoAdjuntoNombre, setNuevoAdjuntoNombre] = useState('')
  const [nuevoAdjuntoUrl, setNuevoAdjuntoUrl] = useState('')
  const estadoTiempo = calcularEstadoTiempoFase(fase)
  const ordenadas = [...proceso.fases].sort((a, b) => a.orden - b.orden)
  const idx = ordenadas.findIndex(f => f.id === fase.id)
  const puedeVolverAtras = idx > 0 && fase.estado !== 'espera'

  const addAdjunto = () => {
    if (!nuevoAdjuntoUrl.trim()) return
    actions.addAdjuntoFase(proceso.id, fase.id, { nombre: nuevoAdjuntoNombre.trim() || 'Documento', url: nuevoAdjuntoUrl.trim() })
    setNuevoAdjuntoNombre('')
    setNuevoAdjuntoUrl('')
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold">{fase.nombre}</h3>
            <EstadoBadge estado={fase.estado} tipo="fase" />
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-xs">
              Proceso: {proceso.nombre} · Cliente: {actions.nombreCliente(proceso.idCliente)}
            </p>
            {estadoTiempo && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 ${estadoTiempo === 'en_tiempo' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                {estadoTiempo === 'en_tiempo' ? '🟢 En tiempo' : '🔴 Vas con retraso'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Fecha inicio prevista</label>
              <input
                type="date"
                value={fase.fechaInicioPrevista}
                onChange={e => actions.actualizarFaseProceso(proceso.id, fase.id, { fechaInicioPrevista: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Fecha fin prevista</label>
              <input
                type="date"
                value={fase.fechaFinPrevista}
                onChange={e => actions.actualizarFaseProceso(proceso.id, fase.id, { fechaFinPrevista: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <p className="text-gray-600 text-xs -mt-2">Si cambias la fecha fin, las fechas de las fases siguientes se desplazan automáticamente.</p>

          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Responsables</label>
            <ResponsablesMultiSelect
              empleados={state.empleados}
              seleccionados={fase.idsResponsables}
              onChange={ids => actions.actualizarFaseProceso(proceso.id, fase.id, { idsResponsables: ids })}
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">Departamento</label>
            <select
              value={fase.idDepartamento ?? ''}
              onChange={e => actions.actualizarFaseProceso(proceso.id, fase.id, { idDepartamento: e.target.value || null })}
              className={inputCls}
            >
              <option value="">Sin departamento</option>
              {state.departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">Descripción / notas</label>
            <textarea
              value={fase.descripcion}
              onChange={e => actions.actualizarFaseProceso(proceso.id, fase.id, { descripcion: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Detalles para quien ejecute esta fase..."
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Adjuntos de Google Drive</label>
            <div className="space-y-1.5 mb-2">
              {fase.adjuntos.length === 0 && <p className="text-gray-600 text-xs">Sin adjuntos.</p>}
              {fase.adjuntos.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-1.5">
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate">
                    📎 {a.nombre}
                  </a>
                  <button onClick={() => actions.eliminarAdjuntoFase(proceso.id, fase.id, a.id)} className="text-gray-500 hover:text-red-400 text-xs px-2">
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={nuevoAdjuntoNombre} onChange={e => setNuevoAdjuntoNombre(e.target.value)} placeholder="Etiqueta" className={`${inputCls} w-32`} />
              <input
                value={nuevoAdjuntoUrl}
                onChange={e => setNuevoAdjuntoUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className={inputCls}
                onKeyDown={e => e.key === 'Enter' && addAdjunto()}
              />
              <button onClick={addAdjunto} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 text-sm">+</button>
            </div>
          </div>

          <div className="bg-gray-800/60 rounded-lg px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">⏱️ Tiempo registrado (vía Fichar)</span>
              <button
                onClick={() => actions.toggleTimerFase(proceso.id, fase.id)}
                className={`rounded px-2 py-1 text-xs ${fase.timerActivo ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300'}`}
              >
                {fase.timerActivo ? '⏸ Parar' : '▶ Iniciar'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={Math.floor(fase.minutosAcumulados / 60)}
                onChange={e => actions.setMinutosFase(proceso.id, fase.id, (parseInt(e.target.value, 10) || 0) * 60 + (fase.minutosAcumulados % 60))}
                className="w-16 bg-gray-800 border border-gray-700 rounded-lg text-white px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-500"
              />
              <span className="text-gray-500 text-xs">h</span>
              <input
                type="number"
                min={0}
                max={59}
                value={fase.minutosAcumulados % 60}
                onChange={e => actions.setMinutosFase(proceso.id, fase.id, Math.floor(fase.minutosAcumulados / 60) * 60 + (parseInt(e.target.value, 10) || 0))}
                className="w-16 bg-gray-800 border border-gray-700 rounded-lg text-white px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-500"
              />
              <span className="text-gray-500 text-xs">min</span>
              <span className="text-gray-500 text-xs ml-auto">Total: {formatMinutos(fase.minutosAcumulados)}</span>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <label className="block text-gray-400 text-sm mb-2">Chat de la tarjeta</label>
            <ChatMock
              mensajes={fase.chat}
              empleados={state.empleados}
              nombreEmpleado={actions.nombreEmpleado}
              onSend={(texto, menciones) => actions.addChatMensajeFase(proceso.id, fase.id, texto, menciones)}
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-800 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cerrar</button>
          {puedeVolverAtras && (
            <button
              onClick={() => actions.volverFaseAnterior(proceso.id, fase.id)}
              title="Reactiva la fase anterior y notifica a su responsable"
              className="flex-1 py-2 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg text-sm font-medium"
            >
              ◀ Volver a fase anterior
            </button>
          )}
          {fase.estado !== 'terminado' && (
            <button
              onClick={() => { actions.marcarFaseTerminada(proceso.id, fase.id); onClose() }}
              disabled={fase.estado === 'espera'}
              className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium"
            >
              Marcar como terminado
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
