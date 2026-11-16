'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ESTADO_CLASE,
  ESTADO_LABEL,
  PLATAFORMA_LABEL,
  TIPO_ACCION_LABEL,
  nombreTipo,
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
  tareas: HubTarea[]
  acciones: HubAccion[]
  esAdmin: boolean
  /** URL del artefacto en Claude. Si viene, se abre en pestaña nueva. */
  creativeLabUrl?: string
  googleConectado?: boolean
  avisoGoogle?: { tipo: string; detalle: string }
}

const inputCls = 'bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

function fmtMin(m: number) {
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

export default function HubClient({ cliente, servicios, cuentas, tareas, acciones, esAdmin, creativeLabUrl = '', googleConectado = false, avisoGoogle }: Props) {
  const router = useRouter()
  const [servicioSel, setServicioSel] = useState<string>(servicios[0]?.id ?? '')
  const [nuevaTarea, setNuevaTarea] = useState('')
  const [creandoTarea, setCreandoTarea] = useState(false)
  const [tituloAccion, setTituloAccion] = useState('')
  const [minutosAccion, setMinutosAccion] = useState('30')
  const [registrando, setRegistrando] = useState(false)
  const [error, setError] = useState('')

  const abiertas = tareas.filter(t => t.estado !== 'terminado').length
  const prioridadEstado = (e: string) => (e === 'terminado' ? 3 : e === 'bloqueada' ? 2 : 1)
  const tareasOrdenadas = [...tareas].sort((a, b) => {
    const d = prioridadEstado(a.estado) - prioridadEstado(b.estado)
    if (d !== 0) return d
    return (a.fecha_limite ?? '9999-12-31') < (b.fecha_limite ?? '9999-12-31') ? -1 : 1
  })
  const minutosMes = acciones.reduce((s, a) => s + Number(a.minutos ?? 0), 0)
  const accionServicio = acciones.filter(a => a.id_servicio === servicioSel)

  const crearTarea = async () => {
    const nombre = nuevaTarea.trim()
    if (!nombre) return
    setCreandoTarea(true)
    setError('')
    try {
      const res = await fetch('/api/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          idCliente: cliente.id,
          idServicio: servicioSel || null,
          tipo: 'tarea',
          fechaLimite: new Date().toISOString().slice(0, 10),
          idsResponsables: [],
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'No se pudo crear')
      }
      setNuevaTarea('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCreandoTarea(false)
    }
  }

  const registrar = async () => {
    const titulo = tituloAccion.trim()
    const mins = parseInt(minutosAccion)
    if (!servicioSel || !titulo || isNaN(mins) || mins <= 0) return
    setRegistrando(true)
    setError('')
    try {
      const res = await fetch('/api/hub/acciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_servicio: servicioSel, titulo, minutos: mins }),
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

  return (
    <div className="p-8 w-full space-y-6">
      {/* cabecera */}
      <div>
        <div className="text-gray-500 text-xs mb-1">
          <Link href="/hub" className="text-blue-400 hover:text-blue-300">Hub</Link> · {cliente.nombre}
        </div>
        <div className="flex items-center gap-3">
          <h2 className="text-[30px] font-bold text-white leading-tight">{cliente.nombre}</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/40 text-purple-300">Hub</span>
        </div>
        <p className="text-gray-500 text-sm mt-0.5">Espacio de trabajo del cliente</p>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
      )}

      {avisoGoogle && (
        <p className={`text-sm rounded-lg px-3 py-2 border ${avisoGoogle.tipo === 'ok'
          ? 'text-green-400 bg-green-500/10 border-green-800/40'
          : 'text-amber-400 bg-amber-500/10 border-amber-800/40'}`}>
          {avisoGoogle.tipo === 'ok'
            ? '✓ Google Ads conectado.'
            : `No se pudo conectar Google Ads (${avisoGoogle.tipo})${avisoGoogle.detalle ? `: ${avisoGoogle.detalle}` : ''}`}
        </p>
      )}

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Tareas abiertas', value: String(abiertas), hint: `de ${tareas.length} en total` },
          { label: 'Horas registradas', value: fmtMin(minutosMes), hint: 'en los servicios' },
          { label: 'Servicios activos', value: String(servicios.length), hint: servicios.slice(0, 2).map(nombreTipo).join(' · ') || '—' },
          { label: 'Cuentas vinculadas', value: String(cuentas.length), hint: cuentas.length ? cuentas.map(c => PLATAFORMA_LABEL[c.plataforma as Plataforma] ?? c.plataforma).join(' · ') : 'ninguna' },
        ].map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-5 min-h-[118px] flex flex-col justify-center">
            <p className="text-gray-500 text-[12px] uppercase tracking-[0.08em] font-semibold">{k.label}</p>
            <p className="text-white text-[36px] font-bold leading-tight mt-1">{k.value}</p>
            <p className="text-gray-500 text-[13px] mt-1 truncate">{k.hint}</p>
          </div>
        ))}
      </div>

      {/* Tareas */}
      <details open className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <summary className="cursor-pointer list-none px-6 py-4 flex items-center gap-2 text-white font-semibold text-[17px]">
          <span className="text-gray-500 text-[10px]">▶</span> Tareas del cliente
          <span className="ml-auto text-gray-500 text-xs font-normal">{abiertas} abiertas · {tareas.length} en total</span>
        </summary>
        <div className="px-5 pb-4">
          <div className="space-y-1">
            {tareas.length === 0 && <p className="text-gray-600 text-sm">Sin tareas todavía.</p>}
            {tareasOrdenadas.map(t => (
              <div key={t.id} className="flex items-center gap-2.5 py-2.5 border-b border-gray-800/60 last:border-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${ESTADO_CLASE[t.estado] ?? ESTADO_CLASE.espera}`}>
                  {ESTADO_LABEL[t.estado] ?? t.estado}
                </span>
                <span className={`flex-1 truncate text-[15px] ${t.estado === 'terminado' ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{t.nombre}</span>
                {t.fecha_limite && (
                  <span className="text-gray-500 text-xs">
                    {new Date(`${t.fecha_limite}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </span>
                )}
                <Link
                  href={`/tareas/vista-global?tarea=${t.id}`}
                  className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 rounded hover:bg-gray-800 flex-shrink-0"
                  title="Abrir tarea"
                >
                  Abrir ↗
                </Link>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              value={nuevaTarea}
              onChange={e => setNuevaTarea(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') crearTarea() }}
              placeholder="Nueva tarea…"
              className={`flex-1 ${inputCls}`}
            />
            <button
              onClick={crearTarea}
              disabled={creandoTarea || !nuevaTarea.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {creandoTarea ? '…' : 'Añadir'}
            </button>
          </div>
        </div>
      </details>

      {/* Creative Lab */}
      <details open className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <summary className="cursor-pointer list-none px-6 py-4 flex items-center gap-2 text-white font-semibold text-[17px]">
          <span className="text-gray-500 text-[10px]">▶</span> Creative Lab
          <span className="ml-auto text-gray-500 text-xs font-normal">evaluar piezas y biblioteca</span>
        </summary>
        <div className="px-5 pb-5">
          <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
            <span className={googleConectado ? 'text-green-400' : 'text-gray-500'}>
              {googleConectado ? '● Google Ads conectado' : '○ Google Ads sin conectar'}
            </span>
            {esAdmin && (
              <a
                href="/api/hub/mcp/connect"
                className="text-blue-400 hover:text-blue-300"
              >
                {googleConectado ? 'Reconectar' : 'Conectar Google Ads'}
              </a>
            )}
          </div>

          {creativeLabUrl ? (
            <div className="border border-gray-800 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium">Creative Lab se abre en Claude</p>
                <p className="text-gray-500 text-sm mt-1">
                  Se abre en una pestaña nueva, así ceosiana sigue abierta detrás y no pierdes nada si la cierras.
                  Al volver, registra aquí el tiempo dedicado.
                </p>
              </div>
              <a
                href={creativeLabUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-purple-600 hover:bg-purple-500 text-white rounded-lg px-4 py-2.5 text-sm font-medium flex-shrink-0"
              >
                Abrir Creative Lab ↗
              </a>
            </div>
          ) : (
            <div className="border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-950 flex items-center justify-between">
                <span className="text-gray-500 text-[11px]">Vista previa · Creative Lab</span>
                <a
                  href={`/creative-lab/index.html?proyecto=${servicioSel}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-[11px]"
                >
                  Abrir a pantalla completa ↗
                </a>
              </div>
              <iframe
                key={servicioSel}
                src={`/creative-lab/index.html?proyecto=${servicioSel}`}
                title="Creative Lab"
                className="w-full block"
                style={{ height: 1150, border: 0 }}
              />
            </div>
          )}
        </div>
      </details>

      {/* Registro de trabajo */}
      <details className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <summary className="cursor-pointer list-none px-6 py-4 flex items-center gap-2 text-white font-semibold text-[17px]">
          <span className="text-gray-500 text-[10px]">▶</span> Registro de trabajo
          <span className="ml-auto text-gray-500 text-xs font-normal">{fmtMin(minutosMes)} en total</span>
        </summary>
        <div className="px-5 pb-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-gray-500 text-xs">Servicio</span>
            <select value={servicioSel} onChange={e => setServicioSel(e.target.value)} className={inputCls}>
              {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            {servicios.length === 0 && <span className="text-gray-600 text-xs">Sin servicios activos</span>}
          </div>
          <div className="space-y-1 mb-3">
            {accionServicio.length === 0 && <p className="text-gray-600 text-sm">Sin trabajo registrado en este servicio.</p>}
            {accionServicio.slice(0, 10).map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm py-1 border-b border-gray-800/60 last:border-0">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{TIPO_ACCION_LABEL[a.tipo] ?? a.tipo}</span>
                <span className="flex-1 truncate text-gray-200">{a.titulo}</span>
                <span className="text-gray-500 text-xs">{a.minutos ? `${a.minutos}m` : '—'}</span>
                <span className="text-gray-600 text-xs w-14 text-right">
                  {new Date(`${a.fecha}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={tituloAccion}
              onChange={e => setTituloAccion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') registrar() }}
              placeholder="Qué has hecho (ej: pausé Display por bajo rendimiento)"
              className={`flex-1 ${inputCls}`}
            />
            <input
              value={minutosAccion}
              onChange={e => setMinutosAccion(e.target.value.replace(/[^0-9]/g, ''))}
              className={`w-20 text-center ${inputCls}`}
              title="Minutos"
            />
            <button
              onClick={registrar}
              disabled={registrando || !tituloAccion.trim()}
              className="bg-green-600 hover:bg-green-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {registrando ? '…' : 'Registrar'}
            </button>
          </div>
          <p className="text-gray-600 text-[11px] mt-2">Registrar crea también el fichaje de ese tiempo en el servicio.</p>
        </div>
      </details>

    </div>
  )
}
