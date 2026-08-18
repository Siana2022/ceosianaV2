'use client'

import { useState } from 'react'
import { useTareas } from '../store'
import { ESTADO_TAREA_LABEL, RECURRENCIA_DIAS, RECURRENCIA_LABEL, TIPO_TAREA_ICONO, TIPO_TAREA_LABEL } from '../mockData'
import { addDays, formatFecha } from '../dateUtils'
import type { EstadoTarea, Recurrencia, Tarea, TipoTarea } from '../types'
import EstadoBadge from './EstadoBadge'
import ChatMock from './ChatMock'
import ResponsablesMultiSelect from './ResponsablesMultiSelect'

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'
const ESTADOS: EstadoTarea[] = ['espera', 'proceso', 'bloqueada', 'terminado']
const RECURRENCIAS: Recurrencia[] = ['ninguna', 'diaria', 'semanal', 'quincenal', 'mensual', 'trimestral', 'anual']
const TIPOS: TipoTarea[] = ['tarea', 'reunion', 'visita']

function formatMinutos(m: number) {
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

export default function TareaDetailModal({ tarea, onClose }: { tarea: Tarea; onClose: () => void }) {
  const { state, actions } = useTareas()
  const [explicacion, setExplicacion] = useState(tarea.explicacionBloqueo ?? '')
  const [nuevoAdjuntoNombre, setNuevoAdjuntoNombre] = useState('')
  const [nuevoAdjuntoUrl, setNuevoAdjuntoUrl] = useState('')

  const addAdjunto = () => {
    if (!nuevoAdjuntoUrl.trim()) return
    actions.addAdjuntoTarea(tarea.id, { nombre: nuevoAdjuntoNombre.trim() || 'Documento', url: nuevoAdjuntoUrl.trim() })
    setNuevoAdjuntoNombre('')
    setNuevoAdjuntoUrl('')
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          actions.addImagenTarea(tarea.id, { nombre: file.name, dataUrl: reader.result })
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const cambiarEstado = (estado: EstadoTarea) => {
    if (estado === 'bloqueada') {
      actions.actualizarTarea(tarea.id, { estado, explicacionBloqueo: explicacion })
    } else {
      actions.actualizarTarea(tarea.id, { estado, explicacionBloqueo: null })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold">{TIPO_TAREA_ICONO[tarea.tipo]} {tarea.nombre}</h3>
            <EstadoBadge estado={tarea.estado} />
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Tipo</label>
            <div className="flex gap-1.5 flex-wrap">
              {TIPOS.map(t => (
                <button
                  key={t}
                  onClick={() => actions.actualizarTarea(tarea.id, { tipo: t })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tarea.tipo === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  {TIPO_TAREA_ICONO[t]} {TIPO_TAREA_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Estado</label>
            <div className="flex gap-1.5 flex-wrap">
              {ESTADOS.map(e => (
                <button
                  key={e}
                  onClick={() => cambiarEstado(e)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tarea.estado === e ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  {ESTADO_TAREA_LABEL[e]}
                </button>
              ))}
            </div>
            {tarea.estado === 'bloqueada' && (
              <div className="mt-3">
                <label className="block text-gray-400 text-sm mb-1">Explicación del bloqueo *</label>
                <div className="flex gap-2">
                  <textarea
                    value={explicacion}
                    onChange={e => setExplicacion(e.target.value)}
                    rows={2}
                    className={`${inputCls} resize-none`}
                    placeholder="¿Por qué está bloqueada esta tarea?"
                  />
                  <button
                    onClick={() => actions.notificarBloqueoTarea(tarea.id, explicacion)}
                    className="bg-amber-600 hover:bg-amber-500 text-white rounded-lg px-4 text-sm font-medium flex-shrink-0"
                  >
                    Enviar
                  </button>
                </div>
                <p className="text-amber-500 text-xs mt-1">Al pulsar &quot;Enviar&quot; se notificará al responsable del proyecto (simulado).</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">Enlace con la información para realizarla</label>
            <input
              value={tarea.enlaceInfo}
              onChange={e => actions.actualizarTarea(tarea.id, { enlaceInfo: e.target.value })}
              placeholder="https://..."
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1.5">
              {tarea.tipo === 'tarea' ? 'Responsables' : 'Asistentes'}
            </label>
            <ResponsablesMultiSelect
              empleados={state.empleados}
              seleccionados={tarea.idsResponsables}
              onChange={ids => actions.actualizarTarea(tarea.id, { idsResponsables: ids })}
            />
          </div>

          <div className={tarea.tipo === 'tarea' ? '' : 'grid grid-cols-2 gap-4'}>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Fecha límite</label>
              <input
                type="date"
                value={tarea.fechaLimite}
                onChange={e => actions.actualizarTarea(tarea.id, { fechaLimite: e.target.value })}
                className={inputCls}
              />
            </div>
            {tarea.tipo !== 'tarea' && (
              <div>
                <label className="block text-gray-400 text-sm mb-1">Hora</label>
                <input
                  type="time"
                  value={tarea.hora ?? ''}
                  onChange={e => actions.actualizarTarea(tarea.id, { hora: e.target.value || null })}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {tarea.tipo !== 'tarea' && (
            <div>
              <label className="block text-gray-400 text-sm mb-1">Lugar {tarea.tipo === 'visita' ? '(dirección)' : '(sala / enlace de videollamada)'}</label>
              <input
                value={tarea.lugar ?? ''}
                onChange={e => actions.actualizarTarea(tarea.id, { lugar: e.target.value || null })}
                placeholder={tarea.tipo === 'visita' ? 'Dirección de la visita...' : 'Sala, o enlace de Meet/Zoom...'}
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label className="block text-gray-400 text-sm mb-1">Recurrencia</label>
            <select
              value={tarea.recurrencia}
              onChange={e => actions.actualizarTarea(tarea.id, { recurrencia: e.target.value as Recurrencia })}
              className={inputCls}
            >
              {RECURRENCIAS.map(r => <option key={r} value={r}>{RECURRENCIA_LABEL[r]}</option>)}
            </select>
            {tarea.recurrencia !== 'ninguna' && (
              <p className="text-gray-600 text-xs mt-1">
                Al marcarla como terminada se creará automáticamente la siguiente, con fecha límite{' '}
                {formatFecha(addDays(tarea.fechaLimite, RECURRENCIA_DIAS[tarea.recurrencia]))}.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Departamento</label>
              <select
                value={tarea.idDepartamento ?? ''}
                onChange={e => actions.actualizarTarea(tarea.id, { idDepartamento: e.target.value || null })}
                className={inputCls}
              >
                <option value="">Sin departamento</option>
                {state.departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Cliente</label>
              <select
                value={tarea.idCliente ?? ''}
                onChange={e => actions.actualizarTarea(tarea.id, { idCliente: e.target.value || null })}
                className={inputCls}
              >
                <option value="">Tarea interna</option>
                {state.clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">Descripción</label>
            <textarea
              value={tarea.descripcion}
              onChange={e => actions.actualizarTarea(tarea.id, { descripcion: e.target.value })}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Explica aquí lo que haga falta..."
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Adjuntos de Google Drive</label>
            <div className="space-y-1.5 mb-2">
              {tarea.adjuntos.length === 0 && <p className="text-gray-600 text-xs">Sin adjuntos.</p>}
              {tarea.adjuntos.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-1.5">
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate">
                    📎 {a.nombre}
                  </a>
                  <button onClick={() => actions.eliminarAdjuntoTarea(tarea.id, a.id)} className="text-gray-500 hover:text-red-400 text-xs px-2">
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

          <div>
            <label className="block text-gray-400 text-sm mb-2">Imágenes adjuntas</label>
            {tarea.imagenes.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {tarea.imagenes.map(img => (
                  <div key={img.id} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.dataUrl} alt={img.nombre} className="w-full h-16 object-cover rounded-lg border border-gray-700" />
                    <button
                      onClick={() => actions.eliminarImagenTarea(tarea.id, img.id)}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 py-2 text-xs cursor-pointer">
              📷 Subir imagen
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            </label>
            <p className="text-gray-600 text-xs mt-1">Solo se guarda en memoria para esta demo (no se sube a ningún servidor).</p>
          </div>

          <div className="bg-gray-800/60 rounded-lg px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">⏱️ Tiempo registrado (vía Fichar)</span>
              <button
                onClick={() => actions.toggleTimerTarea(tarea.id)}
                className={`rounded px-2 py-1 text-xs ${tarea.timerActivo ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300'}`}
              >
                {tarea.timerActivo ? '⏸ Parar' : '▶ Iniciar'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={Math.floor(tarea.minutosAcumulados / 60)}
                onChange={e => actions.setMinutosTarea(tarea.id, (parseInt(e.target.value, 10) || 0) * 60 + (tarea.minutosAcumulados % 60))}
                className="w-16 bg-gray-800 border border-gray-700 rounded-lg text-white px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-500"
              />
              <span className="text-gray-500 text-xs">h</span>
              <input
                type="number"
                min={0}
                max={59}
                value={tarea.minutosAcumulados % 60}
                onChange={e => actions.setMinutosTarea(tarea.id, Math.floor(tarea.minutosAcumulados / 60) * 60 + (parseInt(e.target.value, 10) || 0))}
                className="w-16 bg-gray-800 border border-gray-700 rounded-lg text-white px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-500"
              />
              <span className="text-gray-500 text-xs">min</span>
              <span className="text-gray-500 text-xs ml-auto">Total: {formatMinutos(tarea.minutosAcumulados)}</span>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <label className="block text-gray-400 text-sm mb-2">Chat de la tarea</label>
            <ChatMock
              mensajes={tarea.chat}
              empleados={state.empleados}
              nombreEmpleado={actions.nombreEmpleado}
              onSend={(texto, menciones) => actions.addChatMensajeTarea(tarea.id, texto, menciones)}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
