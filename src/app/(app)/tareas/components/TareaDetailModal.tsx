'use client'

import { useEffect, useRef, useState } from 'react'
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

type TimerStatus = 'idle' | 'loading' | 'running'

export default function TareaDetailModal({ tarea, onClose, isNew = false }: { tarea: Tarea; onClose: () => void; isNew?: boolean }) {
  const { state, actions } = useTareas()

  const savedRef = useRef(false)

  // ── Local draft state (se persiste al pulsar Guardar) ──────────────────
  const [draft, setDraft] = useState({
    nombre: tarea.nombre,
    tipo: tarea.tipo,
    estado: tarea.estado,
    enlaceInfo: tarea.enlaceInfo,
    idsResponsables: tarea.idsResponsables,
    fechaLimite: tarea.fechaLimite,
    hora: tarea.hora,
    lugar: tarea.lugar,
    recurrencia: tarea.recurrencia,
    idDepartamento: tarea.idDepartamento,
    idCliente: tarea.idCliente,
    idServicio: tarea.idServicio,
    descripcion: tarea.descripcion,
    explicacionBloqueo: tarea.explicacionBloqueo ?? '',
    minutosAcumulados: tarea.minutosAcumulados,
    syncCalendar: tarea.syncCalendar,
  })
  const [savedMsg, setSavedMsg] = useState(false)

  const cerrar = () => {
    if (isNew && !savedRef.current) {
      actions.eliminarTarea(tarea.id)
    }
    onClose()
  }

  // ── Timer real (vinculado con /fichar vía time_logs + localStorage) ────
  const [timerStatus, setTimerStatus] = useState<TimerStatus>('idle')
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null)
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null)
  const [timerError, setTimerError] = useState<string | null>(null)

  // Al abrir el modal: restaurar el timer si esta tarea lo inició y sigue activo
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ceosiana_timer_v2')
      if (!saved) return
      const { startTs, dbId, tareaId: savedTareaId } = JSON.parse(saved)
      if (savedTareaId !== tarea.id || !dbId || !startTs) return
      const startedAt = new Date(startTs).toISOString()
      setTimerStatus('running')
      setTimerStartedAt(startedAt)
      setActiveTimerId(dbId)
    } catch {}
  }, [tarea.id])

  // ── Adjuntos ──────────────────────────────────────────────────────────
  const [nuevoAdjuntoNombre, setNuevoAdjuntoNombre] = useState('')
  const [nuevoAdjuntoUrl, setNuevoAdjuntoUrl] = useState('')

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft(d => ({ ...d, [key]: value }))

  // ── Guardar ──────────────────────────────────────────────────────────
  const guardar = () => {
    actions.actualizarTarea(tarea.id, {
      nombre: draft.nombre.trim() || tarea.nombre,
      tipo: draft.tipo,
      estado: draft.estado,
      enlaceInfo: draft.enlaceInfo,
      idsResponsables: draft.idsResponsables,
      fechaLimite: draft.fechaLimite,
      hora: draft.hora,
      lugar: draft.lugar,
      recurrencia: draft.recurrencia,
      idDepartamento: draft.idDepartamento,
      idCliente: draft.idCliente,
      idServicio: draft.idServicio,
      descripcion: draft.descripcion,
      explicacionBloqueo: draft.estado === 'bloqueada' ? draft.explicacionBloqueo : null,
      syncCalendar: draft.syncCalendar,
    })
    if (draft.minutosAcumulados !== tarea.minutosAcumulados) {
      actions.setMinutosTarea(tarea.id, draft.minutosAcumulados)
    }
    savedRef.current = true
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  // ── Adjuntos (inmediatos, no necesitan Guardar) ───────────────────────
  const addAdjunto = () => {
    if (!nuevoAdjuntoUrl.trim()) return
    actions.addAdjuntoTarea(tarea.id, { nombre: nuevoAdjuntoNombre.trim() || 'Documento', url: nuevoAdjuntoUrl.trim() })
    setNuevoAdjuntoNombre('')
    setNuevoAdjuntoUrl('')
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('tareaId', tarea.id)
      try {
        const res = await fetch('/api/tareas/imagenes', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al subir imagen')
        actions.addImagenTarea(tarea.id, { nombre: data.nombre, url: data.url })
      } catch (err) {
        console.error('[imagen] Error al subir:', err)
      }
    }
  }

  // ── Timer ─────────────────────────────────────────────────────────────
  const servicioActivo = state.servicios.find(s => s.id === draft.idServicio)

  const iniciarTimer = async () => {
    setTimerError(null)
    // Guard: if another task's timer is already running, block
    try {
      const existing = localStorage.getItem('ceosiana_timer_v2')
      if (existing) {
        const { tareaId: activeTareaId, dbId, startTs } = JSON.parse(existing)
        if (activeTareaId === tarea.id && dbId && startTs) {
          // Already running for this task (started from card) — just restore state
          setActiveTimerId(dbId)
          setTimerStartedAt(new Date(startTs).toISOString())
          setTimerStatus('running')
          return
        }
        if (activeTareaId !== tarea.id) {
          setTimerError('Ya hay un fichaje activo en otra tarea. Páralo primero.')
          return
        }
      }
    } catch {}
    setTimerStatus('loading')
    const ahora = new Date()
    const horaInicio = ahora.toTimeString().slice(0, 5)
    const fecha = ahora.toISOString().slice(0, 10)
    try {
      const res = await fetch('/api/time-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_cliente: draft.idCliente,
          id_servicio: draft.idServicio,
          id_departamento: draft.idDepartamento,
          descripcion: draft.nombre.trim() || tarea.nombre,
          fecha,
          hora_inicio: horaInicio,
          minutos: 1,
          timer_abierto: true,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error al iniciar')
      }
      const data = await res.json()
      setActiveTimerId(data.id)
      setTimerStartedAt(ahora.toISOString())
      setTimerStatus('running')
      // Comparte el timer con /fichar mediante el mismo localStorage
      localStorage.setItem('ceosiana_timer_v2', JSON.stringify({
        startTs: ahora.getTime(),
        d: draft.nombre.trim() || tarea.nombre,
        c: draft.idCliente ?? '',
        dep: draft.idDepartamento ?? '',
        dbId: data.id,
        tareaId: tarea.id,
      }))
      actions.actualizarTarea(tarea.id, { timerActivo: true })
    } catch (e) {
      setTimerError(e instanceof Error ? e.message : 'Error desconocido')
      setTimerStatus('idle')
    }
  }

  const pausarTimer = async () => {
    if (!timerStartedAt) return
    setTimerStatus('loading')
    setTimerError(null)
    const ahora = new Date()
    const minutosElapsed = Math.max(1, Math.round((ahora.getTime() - new Date(timerStartedAt).getTime()) / 60000))
    const horaFin = ahora.toTimeString().slice(0, 5)
    if (activeTimerId) {
      try {
        await fetch(`/api/time-logs?id=${activeTimerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hora_fin: horaFin, minutos: minutosElapsed }),
        })
      } catch {
        // no blocking — timer se para de todas formas
      }
    }
    actions.actualizarTarea(tarea.id, {
      timerActivo: false,
      minutosAcumulados: draft.minutosAcumulados + minutosElapsed,
    })
    localStorage.removeItem('ceosiana_timer_v2')
    setTimerStartedAt(null)
    setActiveTimerId(null)
    setTimerStatus('idle')
  }

  // ── Servicios filtrados por cliente ──────────────────────────────────
  const serviciosDelCliente = state.servicios.filter(s => s.idCliente === draft.idCliente)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{TIPO_TAREA_ICONO[draft.tipo]}</span>
            <input
              value={draft.nombre}
              onChange={e => set('nombre', e.target.value)}
              className="bg-transparent text-white font-semibold text-base focus:outline-none focus:border-b focus:border-blue-500 w-64"
              placeholder="Nombre de la tarea..."
            />
            <EstadoBadge estado={draft.estado} />
          </div>
          <button onClick={cerrar} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* Tipo */}
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Tipo</label>
            <div className="flex gap-1.5 flex-wrap">
              {TIPOS.map(t => (
                <button
                  key={t}
                  onClick={() => set('tipo', t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${draft.tipo === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  {TIPO_TAREA_ICONO[t]} {TIPO_TAREA_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Estado</label>
            <div className="flex gap-1.5 flex-wrap">
              {ESTADOS.map(e => (
                <button
                  key={e}
                  onClick={() => set('estado', e)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${draft.estado === e ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  {ESTADO_TAREA_LABEL[e]}
                </button>
              ))}
            </div>
            {draft.estado === 'bloqueada' && (
              <div className="mt-3">
                <label className="block text-gray-400 text-sm mb-1">Explicación del bloqueo *</label>
                <textarea
                  value={draft.explicacionBloqueo}
                  onChange={e => set('explicacionBloqueo', e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                  placeholder="¿Por qué está bloqueada esta tarea?"
                />
              </div>
            )}
          </div>

          {/* Enlace info */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Enlace con la información</label>
            <input
              value={draft.enlaceInfo}
              onChange={e => set('enlaceInfo', e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </div>

          {/* Responsables */}
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">
              {draft.tipo === 'tarea' ? 'Responsables' : 'Asistentes'}
            </label>
            <ResponsablesMultiSelect
              empleados={state.empleados}
              seleccionados={draft.idsResponsables}
              onChange={ids => set('idsResponsables', ids)}
            />
          </div>

          {/* Fecha + Hora */}
          <div className={draft.tipo === 'tarea' ? '' : 'grid grid-cols-2 gap-4'}>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Fecha límite</label>
              <input
                type="date"
                value={draft.fechaLimite}
                onChange={e => set('fechaLimite', e.target.value)}
                className={inputCls}
              />
            </div>
            {draft.tipo !== 'tarea' && (
              <div>
                <label className="block text-gray-400 text-sm mb-1">Hora</label>
                <input
                  type="time"
                  value={draft.hora ?? ''}
                  onChange={e => set('hora', e.target.value || null)}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* Lugar (solo reunión/visita) */}
          {draft.tipo !== 'tarea' && (
            <div>
              <label className="block text-gray-400 text-sm mb-1">
                {draft.tipo === 'visita' ? 'Lugar (dirección)' : 'Lugar (sala / enlace de videollamada)'}
              </label>
              <input
                value={draft.lugar ?? ''}
                onChange={e => set('lugar', e.target.value || null)}
                placeholder={draft.tipo === 'visita' ? 'Dirección de la visita...' : 'Sala, o enlace de Meet/Zoom...'}
                className={inputCls}
              />
            </div>
          )}

          {/* Recurrencia */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Recurrencia</label>
            <select
              value={draft.recurrencia}
              onChange={e => set('recurrencia', e.target.value as Recurrencia)}
              className={inputCls}
            >
              {RECURRENCIAS.map(r => <option key={r} value={r}>{RECURRENCIA_LABEL[r]}</option>)}
            </select>
            {draft.recurrencia !== 'ninguna' && (
              <p className="text-gray-600 text-xs mt-1">
                Al marcarla como terminada se creará la siguiente con fecha límite{' '}
                {formatFecha(addDays(draft.fechaLimite, RECURRENCIA_DIAS[draft.recurrencia]))}.
              </p>
            )}
          </div>

          {/* Google Calendar sync */}
          <div className="flex items-center justify-between bg-gray-800/60 rounded-lg px-4 py-3">
            <div>
              <span className="text-gray-300 text-sm font-medium">📅 Sincronizar con Google Calendar</span>
              <p className="text-gray-500 text-xs mt-0.5">Añade esta tarea al calendario de los responsables</p>
            </div>
            <button
              type="button"
              onClick={() => set('syncCalendar', !draft.syncCalendar)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${draft.syncCalendar ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${draft.syncCalendar ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Departamento + Cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Departamento</label>
              <select
                value={draft.idDepartamento ?? ''}
                onChange={e => set('idDepartamento', e.target.value || null)}
                className={inputCls}
              >
                <option value="">Sin departamento</option>
                {state.departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Cliente</label>
              <select
                value={draft.idCliente ?? ''}
                onChange={e => setDraft(d => ({ ...d, idCliente: e.target.value || null, idServicio: null }))}
                className={inputCls}
              >
                <option value="">Tarea interna</option>
                {state.clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Servicio (si hay cliente seleccionado y tiene servicios) */}
          {draft.idCliente && serviciosDelCliente.length > 0 && (
            <div>
              <label className="block text-gray-400 text-sm mb-1">Servicio</label>
              <select
                value={draft.idServicio ?? ''}
                onChange={e => set('idServicio', e.target.value || null)}
                className={inputCls}
              >
                <option value="">Sin servicio específico</option>
                {serviciosDelCliente.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Descripción</label>
            <textarea
              value={draft.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Explica aquí lo que haga falta..."
            />
          </div>

          {/* Adjuntos Drive */}
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

          {/* Imágenes */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Imágenes adjuntas</label>
            {tarea.imagenes.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {tarea.imagenes.map(img => (
                  <div key={img.id} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.nombre} onClick={() => window.open(img.url, '_blank')}
                      className="w-full h-16 object-cover rounded-lg border border-gray-700 cursor-pointer hover:opacity-80 transition-opacity" title={img.nombre} />
                    <button
                      onClick={() => actions.eliminarImagenTarea(tarea.id, img.id)}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
          </div>

          {/* Timer / Fichaje */}
          <div className="bg-gray-800/60 rounded-lg px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-300 text-sm font-medium">⏱️ Fichaje</span>
                {timerStatus === 'running' && timerStartedAt && (
                  <p className="text-green-400 text-xs mt-0.5">
                    Iniciado a las {new Date(timerStartedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    {servicioActivo && ` · ${servicioActivo.nombre}`}
                  </p>
                )}
                {timerStatus === 'idle' && tarea.minutosAcumulados > 0 && (
                  <p className="text-gray-500 text-xs mt-0.5">Acumulado: {formatMinutos(tarea.minutosAcumulados)}</p>
                )}
              </div>
              <div className="flex gap-2">
                {timerStatus === 'idle' && (
                  <button
                    onClick={iniciarTimer}
                    className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/40 rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    ▶ Iniciar
                  </button>
                )}
                {timerStatus === 'running' && (
                  <button
                    onClick={pausarTimer}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    ⏸ Pausar y guardar
                  </button>
                )}
                {timerStatus === 'loading' && (
                  <span className="text-gray-500 text-xs px-3 py-1.5">...</span>
                )}
              </div>
            </div>
            {timerError && (
              <p className="text-red-400 text-xs">{timerError}</p>
            )}
            {/* Ajuste manual de minutos */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={Math.floor(draft.minutosAcumulados / 60)}
                onChange={e => {
                  const newMinutos = (parseInt(e.target.value, 10) || 0) * 60 + (draft.minutosAcumulados % 60)
                  setDraft(d => ({ ...d, minutosAcumulados: newMinutos }))
                }}
                className="w-14 bg-gray-800 border border-gray-700 rounded-lg text-white px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-500"
              />
              <span className="text-gray-500 text-xs">h</span>
              <input
                type="number"
                min={0}
                max={59}
                value={draft.minutosAcumulados % 60}
                onChange={e => {
                  const newMinutos = Math.floor(draft.minutosAcumulados / 60) * 60 + (parseInt(e.target.value, 10) || 0)
                  setDraft(d => ({ ...d, minutosAcumulados: newMinutos }))
                }}
                className="w-14 bg-gray-800 border border-gray-700 rounded-lg text-white px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-500"
              />
              <span className="text-gray-500 text-xs">min</span>
              <span className="text-gray-500 text-xs ml-auto">Total: {formatMinutos(draft.minutosAcumulados)}</span>
            </div>
          </div>

          {/* Chat */}
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

        {/* Footer: Guardar + Cerrar + Eliminar */}
        <div className="px-6 py-4 border-t border-gray-800 flex-shrink-0 flex gap-3">
          <button
            onClick={guardar}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              savedMsg
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {savedMsg ? '✓ Guardado' : 'Guardar cambios'}
          </button>
          <button
            onClick={cerrar}
            className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            Cerrar
          </button>
          <button
            onClick={() => {
              if (!confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.')) return
              actions.eliminarTarea(tarea.id)
              onClose()
            }}
            className="px-3 py-2 bg-red-900/40 hover:bg-red-800/60 text-red-400 hover:text-red-300 rounded-lg text-sm"
            title="Eliminar tarea"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}
