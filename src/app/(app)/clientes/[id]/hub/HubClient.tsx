'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { confirmDialog } from '@/components/confirmDialog'
import {
  ESTADO_CLASE,
  ESTADO_LABEL,
  PLATAFORMA_ICONO,
  PLATAFORMA_LABEL,
  nombreTipo,
  plataformaDe,
  TIPO_ACCION_LABEL,
  type HubAccion,
  type HubCuenta,
  type HubServicio,
  type HubTarea,
  type Plataforma,
} from './types'

interface Props {
  cliente: { id: string; nombre: string; activo: boolean | null }
  servicios: HubServicio[]
  cuentas: HubCuenta[]
  esAdmin: boolean
  tareas: HubTarea[]
  acciones: HubAccion[]
  /** Si se pasa, se muestra un selector para cambiar de cliente sin salir del hub. */
  clientes?: { id: string; nombre: string }[]
}

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

export default function HubClient({ cliente, servicios, cuentas, esAdmin, tareas, acciones, clientes }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<string>('resumen')
  const [modal, setModal] = useState<{ idServicio: string; plataforma: Plataforma } | null>(null)
  const [nombre, setNombre] = useState('')
  const [idExterno, setIdExterno] = useState('')
  const [moneda, setMoneda] = useState('EUR')
  const [guardando, setGuardando] = useState(false)
  const [nuevaTarea, setNuevaTarea] = useState('')
  const [creando, setCreando] = useState(false)
  const [tituloAccion, setTituloAccion] = useState('')
  const [minutosAccion, setMinutosAccion] = useState('30')
  const [registrando, setRegistrando] = useState(false)
  const [error, setError] = useState('')

  const cuentasDe = (idServicio: string) => cuentas.filter(c => c.id_servicio === idServicio)

  const abrirModal = (idServicio: string, plataforma: Plataforma) => {
    setModal({ idServicio, plataforma })
    setNombre('')
    setIdExterno('')
    setMoneda('EUR')
    setError('')
  }

  const vincular = async () => {
    if (!modal) return
    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/hub/cuentas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_servicio: modal.idServicio,
          plataforma: modal.plataforma,
          id_externo: idExterno,
          nombre,
          moneda,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo vincular')
      setModal(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  const desvincular = async (cuenta: HubCuenta) => {
    const ok = await confirmDialog({
      title: 'Desvincular cuenta',
      message: `¿Seguro que quieres desvincular «${cuenta.nombre}»? Se dejarán de sincronizar sus campañas. No se borran datos de la plataforma.`,
      confirmLabel: 'Desvincular',
    })
    if (!ok) return
    const res = await fetch(`/api/hub/cuentas?id=${cuenta.id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
    else {
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? 'No se pudo desvincular')
    }
  }

  const tareasDe = (idServicio: string) => tareas.filter(t => t.id_servicio === idServicio)
  const pendientesDe = (idServicio: string) => tareasDe(idServicio).filter(t => t.estado !== 'terminado').length

  const crearTarea = async (idServicio: string) => {
    const nombre = nuevaTarea.trim()
    if (!nombre) return
    setCreando(true)
    try {
      const res = await fetch('/api/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          idCliente: cliente.id,
          idServicio,
          tipo: 'tarea',
          fechaLimite: new Date().toISOString().slice(0, 10),
          idsResponsables: [],
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'No se pudo crear la tarea')
      }
      setNuevaTarea('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCreando(false)
    }
  }

  const accionesDe = (idServicio: string) => acciones.filter(a => a.id_servicio === idServicio)
  const minutosDe = (idServicio: string) => accionesDe(idServicio).reduce((sum, a) => sum + Number(a.minutos ?? 0), 0)

  const registrarAccion = async (idServicio: string) => {
    const titulo = tituloAccion.trim()
    const mins = parseInt(minutosAccion)
    if (!titulo || isNaN(mins) || mins <= 0) return
    setRegistrando(true)
    setError('')
    try {
      const res = await fetch('/api/hub/acciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_servicio: idServicio, titulo, minutos: mins, tipo: 'optimizacion' }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo registrar')
      setTituloAccion('')
      setMinutosAccion('30')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setRegistrando(false)
    }
  }

  const servicioActivo = servicios.find(s => s.id === tab) ?? null

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/clientes/${cliente.id}`} className="text-gray-400 hover:text-white transition-colors text-sm">
            ← Ficha del cliente
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{cliente.nombre}</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/40 text-purple-300">
                Hub
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">Espacio de trabajo del cliente</p>
            {clientes && clientes.length > 0 && (
              <select
                value={cliente.id}
                onChange={e => router.push(`/hub?cliente=${e.target.value}`)}
                className="mt-2 bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 max-w-xs"
              >
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-800 pb-2">
        <button
          onClick={() => setTab('resumen')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'resumen' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          Resumen
        </button>
        {servicios.map(s => {
          const p = plataformaDe(nombreTipo(s))
          const nCuentas = cuentasDe(s.id).length
          return (
            <button
              key={s.id}
              onClick={() => setTab(s.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === s.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              {p ? PLATAFORMA_ICONO[p] : '🗂️'} {s.nombre}
              {nCuentas > 0 && (
                <span className="text-[10px] bg-gray-700 text-gray-200 rounded-full px-1.5 py-0.5">{nCuentas}</span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Contenido */}
      {tab === 'resumen' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {servicios.length === 0 && (
            <p className="text-gray-500 text-sm">Este cliente no tiene servicios activos.</p>
          )}
          {servicios.map(s => {
            const p = plataformaDe(nombreTipo(s))
            const lista = cuentasDe(s.id)
            return (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-white font-medium">{s.nombre}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{nombreTipo(s) || 'Sin tipo'}</p>
                  </div>
                  <button onClick={() => setTab(s.id)} className="text-blue-400 hover:text-blue-300 text-xs">
                    Abrir →
                  </button>
                </div>
                <div className="mt-3 text-sm">
                  {pendientesDe(s.id) > 0 && (
                    <span className="mr-2 text-xs bg-gray-800 text-gray-300 rounded px-2 py-0.5">
                      {pendientesDe(s.id)} tarea{pendientesDe(s.id) === 1 ? '' : 's'} pendiente{pendientesDe(s.id) === 1 ? '' : 's'}
                    </span>
                  )}
                  {p === null && <span className="text-gray-500 text-xs">Sin plataforma conectada</span>}
                  {p !== null && lista.length === 0 && (
                    <span className="text-amber-400 text-xs">Cuenta sin vincular</span>
                  )}
                  {lista.map(c => (
                    <span key={c.id} className="inline-flex items-center gap-1 text-gray-300 text-xs mr-2">
                      {PLATAFORMA_ICONO[p ?? 'google_ads']} {c.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Actividad reciente: acciones + tareas, lo más nuevo arriba */}
          {(() => {
            const nombreServicio = (id: string | null) => servicios.find(s => s.id === id)?.nombre ?? '—'
            const eventos = [
              ...acciones.map(a => ({
                key: `a-${a.id}`,
                fecha: a.fecha,
                texto: a.titulo,
                meta: `${nombreServicio(a.id_servicio)} · ${a.minutos ? `${a.minutos}m` : 'acción'}`,
                icono: '🛠️',
              })),
              ...tareas.map(t => ({
                key: `t-${t.id}`,
                fecha: t.fecha_limite ?? '',
                texto: t.nombre,
                meta: `${nombreServicio(t.id_servicio)} · ${ESTADO_LABEL[t.estado] ?? t.estado}`,
                icono: '🗂️',
              })),
            ]
              .filter(e => e.fecha)
              .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
              .slice(0, 12)

            return (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:col-span-2">
                <h3 className="text-white font-semibold text-sm mb-3">Actividad reciente</h3>
                {eventos.length === 0 && <p className="text-gray-600 text-xs">Todavía no hay actividad registrada.</p>}
                <div className="space-y-2">
                  {eventos.map(e => (
                    <div key={e.key} className="flex items-start gap-2 text-sm">
                      <span className="flex-shrink-0">{e.icono}</span>
                      <span className="flex-1 min-w-0 truncate text-gray-200">{e.texto}</span>
                      <span className="text-gray-500 text-xs flex-shrink-0 hidden sm:inline">{e.meta}</span>
                      <span className="text-gray-600 text-xs flex-shrink-0 w-16 text-right">
                        {new Date(`${e.fecha}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {servicioActivo && (() => {
        const p = plataformaDe(nombreTipo(servicioActivo))
        const lista = cuentasDe(servicioActivo.id)
        return (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-white font-semibold">{servicioActivo.nombre}</h3>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {p ? `${PLATAFORMA_LABEL[p]} · cuenta vinculada` : 'Servicio sin plataforma conectada'}
                  </p>
                </div>
                {p && esAdmin && (
                  <button
                    onClick={() => abrirModal(servicioActivo.id, p)}
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium"
                  >
                    + Vincular cuenta
                  </button>
                )}
              </div>

              {p === null && (
                <p className="text-gray-500 text-sm mt-4">
                  Aquí verás las acciones, tareas y tiempo de este servicio. Todavía no hay nada que mostrar.
                </p>
              )}

              {p !== null && lista.length === 0 && (
                <p className="text-amber-400/90 text-sm mt-4">
                  Sin cuenta vinculada. {esAdmin ? 'Usa «Vincular cuenta» para conectar la cuenta real.' : 'Pide a un administrador que la vincule.'}
                </p>
              )}

              {lista.map(c => (
                <div key={c.id} className="mt-4 bg-gray-800/50 border border-gray-800 rounded-lg p-4 flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-white text-sm font-medium">{c.nombre}</p>
                    <p className="text-gray-500 text-xs font-mono mt-0.5">{c.id_externo}</p>
                    <p className="text-gray-600 text-xs mt-1">
                      {c.moneda} ·{' '}
                      {c.ultima_sync
                        ? `sincronizado ${new Date(c.ultima_sync).toLocaleString('es-ES')}`
                        : 'sin sincronizar todavía'}
                    </p>
                  </div>
                  {esAdmin && (
                    <button
                      onClick={() => desvincular(c)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Desvincular
                    </button>
                  )}
                </div>
              ))}

              {p !== null && lista.length > 0 && (
                <div className="mt-4 border-t border-gray-800 pt-4">
                  <p className="text-gray-500 text-xs">
                    Inversión, campañas y CPA aparecerán aquí cuando esté conectado el sincronizador.
                  </p>
                </div>
              )}
            </div>

            {/* Tareas del servicio */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-white font-semibold text-sm">Tareas de este servicio</h3>
                <span className="text-gray-500 text-xs">
                  {pendientesDe(servicioActivo.id)} pendientes · {tareasDe(servicioActivo.id).length} en total
                </span>
              </div>

              <div className="space-y-1.5">
                {tareasDe(servicioActivo.id).length === 0 && (
                  <p className="text-gray-600 text-xs">Sin tareas todavía.</p>
                )}
                {tareasDe(servicioActivo.id).map(t => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${ESTADO_CLASE[t.estado] ?? ESTADO_CLASE.espera}`}>
                      {ESTADO_LABEL[t.estado] ?? t.estado}
                    </span>
                    <span className={`flex-1 truncate ${t.estado === 'terminado' ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                      {t.nombre}
                    </span>
                    {t.fecha_limite && (
                      <span className="text-gray-500 text-xs flex-shrink-0">
                        {new Date(`${t.fecha_limite}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-3">
                <input
                  value={nuevaTarea}
                  onChange={e => setNuevaTarea(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') crearTarea(servicioActivo.id) }}
                  placeholder="Nueva tarea…"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => crearTarea(servicioActivo.id)}
                  disabled={creando || !nuevaTarea.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  {creando ? '…' : 'Añadir'}
                </button>
              </div>
            </div>

            {/* Registro de trabajo */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-white font-semibold text-sm">Registro de trabajo</h3>
                <span className="text-gray-500 text-xs">
                  {(() => {
                    const m = minutosDe(servicioActivo.id)
                    const h = Math.floor(m / 60)
                    return m > 0 ? `${h}h ${m % 60}m registradas` : 'sin horas registradas'
                  })()}
                </span>
              </div>

              <div className="space-y-1.5 mb-3">
                {accionesDe(servicioActivo.id).length === 0 && (
                  <p className="text-gray-600 text-xs">Aún no hay trabajo registrado en este servicio.</p>
                )}
                {accionesDe(servicioActivo.id).slice(0, 8).map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/40 text-gray-300 flex-shrink-0">
                      {TIPO_ACCION_LABEL[a.tipo] ?? a.tipo}
                    </span>
                    <span className="flex-1 truncate text-gray-200">{a.titulo}</span>
                    <span className="text-gray-500 text-xs flex-shrink-0">
                      {a.minutos ? `${a.minutos}m` : '—'}
                    </span>
                    <span className="text-gray-600 text-xs flex-shrink-0 w-16 text-right">
                      {new Date(`${a.fecha}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={tituloAccion}
                  onChange={e => setTituloAccion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') registrarAccion(servicioActivo.id) }}
                  placeholder="Qué has hecho (ej: pausé Display por bajo rendimiento)"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  value={minutosAccion}
                  onChange={e => setMinutosAccion(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-20 bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-1.5 text-sm text-center focus:outline-none focus:border-blue-500"
                  title="Minutos"
                />
                <button
                  onClick={() => registrarAccion(servicioActivo.id)}
                  disabled={registrando || !tituloAccion.trim()}
                  className="bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  {registrando ? '…' : 'Registrar'}
                </button>
              </div>
              <p className="text-gray-600 text-[11px] mt-2">
                Registrar crea también el fichaje de ese tiempo en este servicio.
              </p>
            </div>
          </div>
        )
      })()}

      {/* Modal vincular */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-white font-semibold">Vincular cuenta de {PLATAFORMA_LABEL[modal.plataforma]}</h3>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Nombre de la cuenta</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputCls} placeholder="Ej: Meta Ads · España" />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Identificador en la plataforma</label>
              <input value={idExterno} onChange={e => setIdExterno(e.target.value)} className={`${inputCls} font-mono`} placeholder={modal.plataforma === 'google_ads' ? '123-456-7890' : modal.plataforma === 'meta_ads' ? 'act_123456789' : 'properties/123456'} />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Moneda</label>
              <input value={moneda} onChange={e => setMoneda(e.target.value)} className={inputCls} />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300">
                Cancelar
              </button>
              <button
                onClick={vincular}
                disabled={guardando || !nombre.trim() || !idExterno.trim()}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
              >
                {guardando ? 'Vinculando…' : 'Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
