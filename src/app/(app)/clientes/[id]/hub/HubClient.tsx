'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { confirmDialog } from '@/components/confirmDialog'
import {
  ESTADO_CLASE,
  ESTADO_LABEL,
  PLATAFORMA_LABEL,
  TIPO_ACCION_LABEL,
  nombreTipo,
  type HubAccion,
  type HubNota,
  type HubProceso,
  type HubCuenta,
  type HubServicio,
  type HubTarea,
  type Plataforma,
} from './types'

interface Props {
  cliente: { id: string; nombre: string; activo: boolean | null; token_portal?: string | null }
  servicios: HubServicio[]
  cuentas: HubCuenta[]
  tareas: HubTarea[]
  acciones: HubAccion[]
  notas: HubNota[]
  procesos: HubProceso[]
  tokenPortal?: string | null
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

export default function HubClient({ cliente, servicios, cuentas, tareas, acciones, notas, procesos, tokenPortal = null, esAdmin, creativeLabUrl = '', googleConectado = false, avisoGoogle }: Props) {
  const router = useRouter()
  const [servicioSel, setServicioSel] = useState<string>(servicios[0]?.id ?? '')
  const [nuevaTarea, setNuevaTarea] = useState('')
  const [creandoTarea, setCreandoTarea] = useState(false)
  const [tituloAccion, setTituloAccion] = useState('')
  const [minutosAccion, setMinutosAccion] = useState('30')
  const [registrando, setRegistrando] = useState(false)
  const [notaTitulo, setNotaTitulo] = useState('')
  const [notaTexto, setNotaTexto] = useState('')
  const [notaCompartida, setNotaCompartida] = useState(false)
  const [guardandoNota, setGuardandoNota] = useState(false)
  const [nuevoProceso, setNuevoProceso] = useState('')
  const [creandoProceso, setCreandoProceso] = useState(false)
  const [token, setToken] = useState<string | null>(tokenPortal)
  const [creandoToken, setCreandoToken] = useState(false)
  const [origen, setOrigen] = useState('')
  const [disponibles, setDisponibles] = useState<{ id: string; nombre: string; moneda: string }[]>([])
  const [cargandoDisp, setCargandoDisp] = useState(false)
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

  const repetirProceso = async (pr: HubProceso) => {
    const ok = await confirmDialog({
      title: 'Repetir proceso',
      message: `Se reiniciarán las fases de «${pr.nombre}» con las fechas del siguiente mes.`,
      confirmLabel: 'Repetir',
      danger: false,
    })
    if (!ok) return
    setError('')

    const sumarMes = (iso?: string) => {
      const base = iso ? new Date(`${iso}T12:00:00`) : new Date()
      base.setMonth(base.getMonth() + 1)
      return base.toISOString().slice(0, 10)
    }

    const fases = pr.fases.map(f => ({
      ...f,
      estado: 'espera',
      fechaCompletado: null,
      minutosAcumulados: 0,
      timerActivo: false,
      fechaInicioPrevista: sumarMes(f.fechaInicioPrevista),
      fechaFinPrevista: sumarMes(f.fechaFinPrevista),
    }))

    try {
      const res = await fetch(`/api/procesos?id=${pr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fases }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'No se pudo repetir')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  const crearProceso = async () => {
    const nombre = nuevoProceso.trim()
    if (!nombre) return
    setCreandoProceso(true)
    setError('')
    const hoy = new Date().toISOString().slice(0, 10)
    const fin = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    try {
      const res = await fetch('/api/procesos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idCliente: cliente.id,
          idServicio: null,
          idPlantilla: '',
          nombre,
          fases: [{
            id: crypto.randomUUID(),
            nombre: 'Fase 1',
            orden: 1,
            idDepartamento: null,
            idsResponsables: [],
            fechaInicioPrevista: hoy,
            fechaFinPrevista: fin,
            estado: 'espera',
            fechaCompletado: null,
            adjuntos: [],
            minutosAcumulados: 0,
            timerActivo: false,
            descripcion: '',
            chat: [],
          }],
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo crear')
      setNuevoProceso('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCreandoProceso(false)
    }
  }

  useEffect(() => { setOrigen(window.location.origin) }, [])

  const cargarDisponibles = async () => {
    if (disponibles.length || cargandoDisp) return
    setCargandoDisp(true)
    try {
      const res = await fetch('/api/hub/cuentas/disponibles')
      const d = await res.json().catch(() => ({}))
      setDisponibles((d as { cuentas?: { id: string; nombre: string; moneda: string }[] }).cuentas ?? [])
    } catch {
      setDisponibles([])
    } finally {
      setCargandoDisp(false)
    }
  }

  const vincularCuenta = async (idServicio: string, idExterno: string) => {
    if (!idExterno) return
    const cuenta = disponibles.find(c => c.id === idExterno)
    if (!cuenta) return
    setError('')
    const res = await fetch('/api/hub/cuentas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_servicio: idServicio,
        plataforma: 'google_ads',
        id_externo: cuenta.id,
        nombre: cuenta.nombre,
        moneda: cuenta.moneda,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? 'No se pudo vincular la cuenta')
      return
    }
    router.refresh()
  }

  const crearEnlace = async () => {
    setCreandoToken(true)
    setError('')
    try {
      const res = await fetch('/api/hub/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_cliente: cliente.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo crear el enlace')
      setToken((d as { token: string }).token)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCreandoToken(false)
    }
  }

  const revocarEnlace = async () => {
    const ok = await confirmDialog({
      title: 'Revocar enlace del portal',
      message: 'El cliente dejará de poder abrir su portal con el enlace actual. Podrás crear uno nuevo.',
      confirmLabel: 'Revocar',
    })
    if (!ok) return
    const res = await fetch(`/api/hub/portal?id_cliente=${cliente.id}`, { method: 'DELETE' })
    if (res.ok) setToken(null)
  }

  const guardarNota = async () => {
    const titulo = notaTitulo.trim()
    if (!titulo) return
    setGuardandoNota(true)
    setError('')
    try {
      const res = await fetch('/api/hub/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_cliente: cliente.id,
          titulo,
          contenido: notaTexto,
          visibilidad: notaCompartida ? 'compartida' : 'interna',
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo guardar')
      setNotaTitulo(''); setNotaTexto(''); setNotaCompartida(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardandoNota(false)
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
                src={`/creative-lab/index.html?proyecto=${servicioSel}&v=20261118b`}
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

      {/* Cuentas de anuncios */}
      <details
        className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
        onToggle={e => { if ((e.currentTarget as HTMLDetailsElement).open) void cargarDisponibles() }}
      >
        <summary className="cursor-pointer list-none px-6 py-4 flex items-center gap-2 text-white font-semibold text-[17px]">
          <span className="text-gray-500 text-[10px]">▶</span> Cuentas de anuncios
          <span className="ml-auto text-gray-500 text-xs font-normal">
            {cuentas.length === 0 ? 'sin vincular' : `${cuentas.length} vinculada${cuentas.length === 1 ? '' : 's'}`}
          </span>
        </summary>
        <div className="px-6 pb-5 space-y-3">
          <p className="text-gray-500 text-sm">
            Indica qué cuenta de Google Ads corresponde a cada servicio. Es lo que permite traer sus datos y guardarlos en el conocimiento del cliente.
          </p>
          {servicios.length === 0 && <p className="text-gray-600 text-sm">Este cliente no tiene servicios.</p>}
          {servicios.map(sv => {
            const actual = cuentas.find(c => c.id_servicio === sv.id && c.plataforma === 'google_ads')
            return (
              <div key={sv.id} className="flex flex-col sm:flex-row sm:items-center gap-2 border border-gray-800 rounded-lg px-4 py-3">
                <span className="text-gray-200 text-sm flex-1 truncate">{sv.nombre}</span>
                {actual ? (
                  <span className="text-gray-400 text-xs">{actual.nombre} · {actual.id_externo}</span>
                ) : (
                  <span className="text-gray-600 text-xs">sin cuenta</span>
                )}
                <select
                  value={actual?.id_externo ?? ''}
                  onChange={e => vincularCuenta(sv.id, e.target.value)}
                  disabled={cargandoDisp}
                  className={`sm:w-72 ${inputCls}`}
                >
                  <option value="">{cargandoDisp ? 'Cargando cuentas…' : '— Elegir cuenta —'}</option>
                  {disponibles.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} · {c.id}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </details>

      {/* Portal del cliente */}
      <details className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <summary className="cursor-pointer list-none px-6 py-4 flex items-center gap-2 text-white font-semibold text-[17px]">
          <span className="text-gray-500 text-[10px]">▶</span> Portal del cliente
          <span className="ml-auto text-gray-500 text-xs font-normal">
            {token ? 'enlace activo' : 'sin enlace'}
          </span>
        </summary>
        <div className="px-6 pb-5">
          {!token && (
            <p className="text-gray-500 text-sm mb-3">
              Crea un enlace privado para que el cliente vea el avance, las tareas compartidas y el conocimiento marcado como compartido. No necesita cuenta.
            </p>
          )}
          {token && (
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <input
                readOnly
                value={`${origen}/portal/${token}`}
                className={`flex-1 ${inputCls} font-mono text-xs`}
                onFocus={e => e.currentTarget.select()}
              />
              <button
                onClick={() => { void navigator.clipboard.writeText(`${origen}/portal/${token}`) }}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                Copiar
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={crearEnlace}
              disabled={creandoToken}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {creandoToken ? '…' : token ? 'Renovar enlace' : 'Crear enlace del portal'}
            </button>
            {token && (
              <button onClick={revocarEnlace} className="text-red-400 hover:text-red-300 text-sm px-3">
                Revocar
              </button>
            )}
          </div>
          {token && (
            <p className="text-gray-600 text-[11px] mt-2">
              Comparte solo lo marcado como compartido: tareas y notas. Lo interno nunca aparece.
            </p>
          )}
        </div>
      </details>

      {/* Procesos */}
      <details className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <summary className="cursor-pointer list-none px-6 py-4 flex items-center gap-2 text-white font-semibold text-[17px]">
          <span className="text-gray-500 text-[10px]">▶</span> Procesos del cliente
          <span className="ml-auto text-gray-500 text-xs font-normal">
            {procesos.length === 0 ? 'ninguno' : `${procesos.length} proceso${procesos.length === 1 ? '' : 's'}`}
          </span>
        </summary>
        <div className="px-6 pb-5">
          <div className="space-y-2 mb-4">
            {procesos.length === 0 && (
              <p className="text-gray-600 text-sm">Todavía no hay procesos. Crea uno y añade fases después.</p>
            )}
            {procesos.map(pr => {
              const total = pr.fases?.length ?? 0
              const hechas = (pr.fases ?? []).filter(f => f.estado === 'terminado').length
              const pct = total ? Math.round((hechas / total) * 100) : 0
              return (
                <div key={pr.id} className="border border-gray-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-200 text-sm font-medium flex-1 truncate">{pr.nombre}</span>
                    <span className="text-gray-500 text-xs">{hechas}/{total} fases</span>
                    {total > 0 && hechas === total && (
                      <button
                        onClick={() => repetirProceso(pr)}
                        className="text-green-400 hover:text-green-300 text-xs"
                        title="Reiniciar con las fechas del mes siguiente"
                      >
                        Repetir ↻
                      </button>
                    )}
                    <Link
                      href="/tareas/vista-global"
                      className="text-blue-400 hover:text-blue-300 text-xs"
                      title="Los procesos se editan en Tareas"
                    >
                      Ver en Tareas ↗
                    </Link>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex gap-2">
            <input
              value={nuevoProceso}
              onChange={e => setNuevoProceso(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') crearProceso() }}
              placeholder="Nombre del proceso (ej: Artículos mensuales)"
              className={`flex-1 ${inputCls}`}
            />
            <button
              onClick={crearProceso}
              disabled={creandoProceso || !nuevoProceso.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {creandoProceso ? '…' : 'Crear proceso'}
            </button>
          </div>
        </div>
      </details>

      {/* Conocimiento */}
      <details className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <summary className="cursor-pointer list-none px-6 py-4 flex items-center gap-2 text-white font-semibold text-[17px]">
          <span className="text-gray-500 text-[10px]">▶</span> Conocimiento del cliente
          <span className="ml-auto text-gray-500 text-xs font-normal">
            {notas.length === 0 ? 'sin notas' : `${notas.length} nota${notas.length === 1 ? '' : 's'}`}
          </span>
        </summary>
        <div className="px-6 pb-5">
          <div className="space-y-2 mb-4">
            {notas.length === 0 && (
              <p className="text-gray-600 text-sm">Aquí quedan las decisiones y aprendizajes del cliente.</p>
            )}
            {notas.map(n => (
              <div key={n.id} className="border border-gray-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${n.visibilidad === 'compartida' ? 'bg-blue-900/40 text-blue-300' : 'bg-gray-800 text-gray-400'}`}>
                    {n.visibilidad === 'compartida' ? 'Compartida' : 'Interna'}
                  </span>
                  <span className="text-gray-200 text-sm font-medium flex-1 truncate">{n.titulo}</span>
                  <span className="text-gray-600 text-xs">
                    {new Date(n.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                {n.contenido && <p className="text-gray-400 text-[13px] mt-1.5 whitespace-pre-wrap">{n.contenido}</p>}
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-4 space-y-2">
            <input
              value={notaTitulo}
              onChange={e => setNotaTitulo(e.target.value)}
              placeholder="Título de la nota (ej: pausamos Display por CPA alto)"
              className={`w-full ${inputCls}`}
            />
            <textarea
              value={notaTexto}
              onChange={e => setNotaTexto(e.target.value)}
              placeholder="Contexto, decisión, por qué…"
              rows={3}
              className={`w-full ${inputCls}`}
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-gray-400 text-[13px]">
                <input type="checkbox" checked={notaCompartida} onChange={e => setNotaCompartida(e.target.checked)} className="accent-blue-500" />
                Compartida con el cliente
              </label>
              <button
                onClick={guardarNota}
                disabled={guardandoNota || !notaTitulo.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {guardandoNota ? '…' : 'Guardar nota'}
              </button>
            </div>
          </div>
        </div>
      </details>

    </div>
  )
}
