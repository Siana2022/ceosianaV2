'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { evaluarFormula, variablesDeFila } from '@/lib/informes/formula'

export interface Bloque {
  id: string
  tipo: 'kpi' | 'serie' | 'tabla' | 'campanas' | 'kpis' | 'embudo'
  titulo: string
  metrica: Metrica
  metricas?: Metrica[]
  formato?: 'auto' | 'euro' | 'porcentaje' | 'numero' | 'x'
  decimales?: number
}

export type Metrica = 'coste' | 'conversiones' | 'cpa' | 'roas' | 'clics' | 'impresiones' | 'ctr'
  | 'sesiones' | 'usuarios' | 'carritos' | 'compras' | 'ingresos' | 'aov' | 'cr'

interface CampoCatalogo {
  variable: string
  etiqueta: string
  tipo: 'metrica' | 'dimension'
  fuente: string
}

interface FuenteCatalogo {
  id: string
  nombre: string
  conectada: boolean
  motivo?: string
}

export interface Calculada {
  id: string
  nombre: string
  formula: string
  formato: 'numero' | 'euro' | 'porcentaje' | 'x'
}

export interface Informe {
  id: string
  nombre: string
  descripcion: string | null
  tipo: string
  config: { bloques?: Bloque[]; calculadas?: Calculada[] } | null
  publico: boolean
  orden: number
}

interface Datos {
  totales: Record<string, number | null> | null
  anterior?: Record<string, number | null> | null
  porMes: Record<string, number | string | null>[]
  porCampana: Record<string, number | string | null>[]
  motivo?: string
  error?: string
}

const METRICAS: Record<Metrica, { label: string; formato: (v: number) => string }> = {
  sesiones: { label: 'Sesiones', formato: v => v.toLocaleString('es-ES', { maximumFractionDigits: 0 }) },
  usuarios: { label: 'Usuarios', formato: v => v.toLocaleString('es-ES', { maximumFractionDigits: 0 }) },
  carritos: { label: 'Añadidos al carrito', formato: v => v.toLocaleString('es-ES', { maximumFractionDigits: 0 }) },
  compras: { label: 'Compras', formato: v => v.toLocaleString('es-ES', { maximumFractionDigits: 0 }) },
  ingresos: { label: 'Ingresos', formato: v => `${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €` },
  aov: { label: 'AOV', formato: v => `${v.toFixed(2)} €` },
  cr: { label: 'Conversión (%)', formato: v => `${v.toFixed(2)} %` },
  coste: { label: 'Inversión', formato: v => `${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €` },
  conversiones: { label: 'Conversiones', formato: v => v.toFixed(1) },
  cpa: { label: 'CPA', formato: v => `${v.toFixed(2)} €` },
  roas: { label: 'ROAS', formato: v => `${v.toFixed(2)}×` },
  clics: { label: 'Clics', formato: v => v.toLocaleString('es-ES', { maximumFractionDigits: 0 }) },
  impresiones: { label: 'Impresiones', formato: v => v.toLocaleString('es-ES', { maximumFractionDigits: 0 }) },
  ctr: { label: 'CTR', formato: v => `${v.toFixed(2)} %` },
}

function formatearCalc(valor: number | null, formato: Calculada['formato']): string {
  if (valor === null) return '—'
  if (formato === 'euro') return `${valor.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`
  if (formato === 'porcentaje') return `${valor.toFixed(2)} %`
  if (formato === 'x') return `${valor.toFixed(2)}×`
  return valor.toLocaleString('es-ES', { maximumFractionDigits: 2 })
}

const input = 'bg-white border border-[#d8d3c9] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none focus:border-[#3B63FB]'
const INPUT_CALC = input

function nuevoBloque(tipo: Bloque['tipo']): Bloque {
  return { id: crypto.randomUUID(), tipo, titulo: METRICAS.coste.label, metrica: 'coste' }
}

export default function InformesClient({
  idCliente, informes, esAdmin,
}: {
  idCliente: string
  informes: Informe[]
  esAdmin: boolean
}) {
  const router = useRouter()
  const [activo, setActivo] = useState<string | null>(informes[0]?.id ?? null)
  const [editando, setEditando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [periodo, setPeriodo] = useState<'30d' | 'mes' | 'ano'>('30d')
  const [catalogo, setCatalogo] = useState<{ fuentes: FuenteCatalogo[]; campos: CampoCatalogo[] } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [destino, setDestino] = useState<number>(-1)
  const [fuente, setFuente] = useState<'google_ads' | 'ga4'>('google_ads')

  const informe = informes.find(i => i.id === activo) ?? null
  const [bloques, setBloques] = useState<Bloque[]>(informe?.config?.bloques ?? [])
  const [calculadas, setCalculadas] = useState<Calculada[]>(informe?.config?.calculadas ?? [])

  // Cargar métricas de Google Ads según el periodo
  useEffect(() => {
    const hoy = new Date()
    let desde: string
    let hasta = hoy.toISOString().slice(0, 10)
    if (periodo === '30d') desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    else if (periodo === 'mes') desde = `${hoy.toISOString().slice(0, 7)}-01`
    else desde = `${hoy.getFullYear()}-01-01`

    setCargando(true)
    fetch(`/api/informes/datos?id_cliente=${idCliente}&fuente=${fuente}&desde=${desde}&hasta=${hasta}`)
      .then(r => r.json())
      .then(d => setDatos(d))
      .catch(() => setDatos({ totales: null, porMes: [], porCampana: [], error: 'No se pudieron cargar los datos' }))
      .finally(() => setCargando(false))
  }, [idCliente, periodo, fuente])

  useEffect(() => {
    fetch(`/api/informes/campos?id_cliente=${idCliente}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setCatalogo(d))
      .catch(() => setCatalogo(null))
  }, [idCliente])

  const anadirBloqueDeCampo = (metrica: string, etiqueta: string) => {
    setBloques(prev => [...prev, {
      id: crypto.randomUUID(),
      tipo: 'kpi',
      titulo: etiqueta,
      metrica: metrica as Metrica,
    }])
  }

  const seleccionar = (inf: Informe) => {
    setActivo(inf.id)
    setBloques(inf.config?.bloques ?? [])
    setCalculadas(inf.config?.calculadas ?? [])
    setEditando(false)
  }

  const crear = async () => {
    if (!nombreNuevo.trim()) return
    setGuardando(true)
    try {
      const res = await fetch('/api/informes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_cliente: idCliente, nombre: nombreNuevo }),
      })
      if (res.ok) { setNombreNuevo(''); router.refresh() }
    } finally { setGuardando(false) }
  }

  const guardar = async () => {
    if (!informe) return
    setGuardando(true)
    try {
      await fetch(`/api/informes?id=${informe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { bloques, calculadas } }),
      })
      setEditando(false)
      router.refresh()
    } finally { setGuardando(false) }
  }

  const borrar = async () => {
    if (!informe) return
    await fetch(`/api/informes?id=${informe.id}`, { method: 'DELETE' })
    setActivo(null)
    router.refresh()
  }

  const meses = useMemo(() => datos?.porMes ?? [], [datos])

  // Valor de un bloque para una fila (mes) o para los totales
  const valorDe = (b: Bloque, fila: Record<string, unknown> | null | undefined): number | null => {
    if (!fila) return null
    if (b.metrica.startsWith('calc:')) {
      const calc = calculadas.find(c => `calc:${c.id}` === b.metrica)
      if (!calc) return null
      return evaluarFormula(calc.formula, variablesDeFila(fila))
    }
    const v = fila[b.metrica]
    return v === null || v === undefined ? null : Number(v)
  }

  const variacion = (b: Bloque, actual: number | null): number | null => {
    if (actual === null) return null
    const previo = valorDe(b, datos?.anterior as Record<string, unknown> | null)
    if (previo === null || previo === 0) return null
    return ((actual - previo) / Math.abs(previo)) * 100
  }

  const formatoDe = (b: Bloque) => {
    const dec = b.decimales ?? 2
    const elegido = b.formato ?? 'auto'

    if (elegido !== 'auto') {
      return (v: number) => {
        const n = v.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec })
        if (elegido === 'euro') return `${n} €`
        if (elegido === 'porcentaje') return `${n} %`
        if (elegido === 'x') return `${n}×`
        return n
      }
    }

    if (b.metrica.startsWith('calc:')) {
      const calc = calculadas.find(c => `calc:${c.id}` === b.metrica)
      return (v: number) => formatearCalc(v, calc?.formato ?? 'numero')
    }
    return METRICAS[b.metrica as Metrica]?.formato ?? ((v: number) => String(v))
  }

  return (
    <div className="space-y-5">
      {/* Informes + periodo */}
      <div className="flex items-center gap-2 flex-wrap">
        {informes.map(inf => (
          <button
            key={inf.id}
            onClick={() => seleccionar(inf)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              inf.id === activo ? 'bg-[#3B63FB] text-white border-[#3B63FB]' : 'bg-white text-[#1f1e1c] border-[#d8d3c9] hover:border-[#3B63FB]'
            }`}
          >
            {inf.nombre}
          </button>
        ))}

        <div className="flex gap-1 bg-[#f3f1ec] rounded-lg p-1 ml-auto">
          {([['google_ads', 'Google Ads'], ['ga4', 'GA4']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFuente(k)}
              className={`px-3 py-1 rounded text-xs font-medium ${fuente === k ? 'bg-white text-[#111] shadow-sm' : 'text-[#6f6a62]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-[#f3f1ec] rounded-lg p-1">
          {([['30d', '30 días'], ['mes', 'Este mes'], ['ano', 'Año']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setPeriodo(k)}
              className={`px-3 py-1 rounded text-xs font-medium ${periodo === k ? 'bg-white text-[#111] shadow-sm' : 'text-[#6f6a62]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {esAdmin && (
          <div className="flex items-center gap-2">
            <input
              value={nombreNuevo}
              onChange={e => setNombreNuevo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void crear() }}
              placeholder="Nuevo informe…"
              className={`${input} w-44`}
            />
            <button onClick={crear} disabled={guardando || !nombreNuevo.trim()} className="bg-[#111] text-white rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40">
              + Crear
            </button>
          </div>
        )}
      </div>

      {!informe && (
        <div className="bg-white border border-[#dcd7cd] rounded-xl p-8 text-center text-[#6f6a62] text-sm">
          Todavía no hay informes. Crea uno para montar el dashboard del cliente.
        </div>
      )}

      {informe && (
        <div className="bg-white border border-[#dcd7cd] rounded-xl">
          <div className="px-6 py-4 border-b border-[#e6e1d8] flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-[#111] font-semibold">{informe.nombre}</h3>
              <p className="text-[#6f6a62] text-xs mt-0.5">
                {bloques.length} bloques · Google Ads {cargando ? '· cargando…' : datos?.motivo ? `· ${datos.motivo}` : ''}
              </p>
            </div>
            {esAdmin && (
              <div className="flex items-center gap-2">
                {editando ? (
                  <>
                    <button onClick={() => setEditando(false)} className="text-[#6f6a62] text-sm px-3 py-1.5">Cancelar</button>
                    <button onClick={guardar} disabled={guardando} className="bg-[#3B63FB] text-white rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-40">
                      {guardando ? '…' : 'Guardar'}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setEditando(true)} className="bg-[#111] text-white rounded-lg px-3 py-1.5 text-sm font-medium">Editar bloques</button>
                    <button onClick={borrar} className="text-red-600 text-sm px-2">Borrar</button>
                  </>
                )}
              </div>
            )}
          </div>

          {editando && (
            <div className="px-6 py-3 border-b border-[#e6e1d8] bg-[#f7f5f1] space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#6f6a62]">Añadir bloque:</span>
              {([
                ['kpi', '· KPI'],
                ['serie', '▮ Serie mensual'],
                ['tabla', '▦ Tabla mensual'],
                ['campanas', '▤ Tabla de campañas'],
                ['kpis', '≡ Fila de KPIs'],
                ['embudo', '⇩ Embudo'],
              ] as const).map(([t, label]) => (
                <button key={t} onClick={() => setBloques(prev => [...prev, nuevoBloque(t)])} className="bg-white border border-[#d8d3c9] rounded-lg px-3 py-1 text-xs font-medium text-[#111] hover:border-[#3B63FB]">
                  {label}
                </button>
              ))}
              </div>

              {/* Métricas calculadas */}
              <div className="border-t border-[#e6e1d8] pt-3">
                <p className="text-xs text-[#6f6a62] mb-2">
                  Métricas calculadas · variables: inversion, conversiones, cpa, roas, clics, impresiones, ctr, valor
                </p>
                <div className="space-y-2">
                  {calculadas.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2 flex-wrap">
                      <input
                        value={c.nombre}
                        onChange={e => setCalculadas(prev => prev.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))}
                        placeholder="Nombre"
                        className={`${INPUT_CALC} w-40`}
                      />
                      <span className="text-xs text-[#6f6a62]">=</span>
                      <input
                        value={c.formula}
                        onFocus={() => setDestino(i)}
                        onChange={e => setCalculadas(prev => prev.map((x, j) => j === i ? { ...x, formula: e.target.value } : x))}
                        placeholder="inversion / conversiones"
                        className={`${INPUT_CALC} flex-1 font-mono`}
                      />
                      <select
                        value={c.formato}
                        onChange={e => setCalculadas(prev => prev.map((x, j) => j === i ? { ...x, formato: e.target.value as Calculada['formato'] } : x))}
                        className="text-xs border border-[#d8d3c9] rounded px-1 py-2"
                      >
                        <option value="numero">Número</option>
                        <option value="euro">€</option>
                        <option value="porcentaje">%</option>
                        <option value="x">×</option>
                      </select>
                      <button onClick={() => setCalculadas(prev => prev.filter((_, j) => j !== i))} className="text-red-600 text-xs px-1">✕</button>
                    </div>
                  ))}
                  <button
                    onClick={() => setCalculadas(prev => [...prev, { id: crypto.randomUUID(), nombre: 'Coste por clic', formula: 'inversion / clics', formato: 'euro' }])}
                    className="bg-white border border-[#d8d3c9] rounded-lg px-3 py-1 text-xs font-medium text-[#111] hover:border-[#3B63FB]"
                  >
                    + Métrica calculada
                  </button>
                </div>

                {/* Panel de campos disponibles */}
                <div className="mt-3 border border-[#d8d3c9] rounded-lg bg-white overflow-hidden">
                  <div className="px-3 py-2 border-b border-[#e6e1d8] flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#111]">Campos disponibles</span>
                    <input
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      placeholder="Buscar campo…"
                      className="ml-auto text-xs border border-[#d8d3c9] rounded px-2 py-1 w-40"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-[#f0ece4]">
                    {(catalogo?.fuentes ?? []).map(f => {
                      const campos = (catalogo?.campos ?? []).filter(c =>
                        c.fuente === f.id &&
                        (busqueda === '' || c.etiqueta.toLowerCase().includes(busqueda.toLowerCase())),
                      )
                      if (campos.length === 0) return null
                      return (
                        <div key={f.id}>
                          <div className="px-3 py-1.5 bg-[#faf8f4] flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-[#1f1e1c]">{f.nombre}</span>
                            {!f.conectada && (
                              <span className="text-[10px] text-[#8a847a]">· {f.motivo ?? 'sin conectar'}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 px-3 py-2">
                            {campos.map(c => (
                              <button
                                key={c.variable}
                                onClick={() => anadirBloqueDeCampo(c.variable, c.etiqueta)}
                                title={f.conectada ? `${c.variable} — clic para insertar` : `${c.variable} — falta conectar ${f.nombre}`}
                                className={`text-[11px] px-2 py-1 rounded border ${
                                  f.conectada
                                    ? 'bg-[#f3f1ec] border-[#d8d3c9] text-[#111] hover:border-[#3B63FB]'
                                    : 'bg-white border-dashed border-[#d8d3c9] text-[#a39c92]'
                                }`}
                              >
                                {c.etiqueta}
                                <span className="block text-[9px] opacity-60 font-mono">{c.variable}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                    {calculadas.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-[#faf8f4] flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-[#1f1e1c]">Calculadas</span>
                        </div>
                        <div className="flex flex-wrap gap-1 px-3 py-2">
                          {calculadas.map(c => (
                            <button
                              key={c.id}
                              onClick={() => anadirBloqueDeCampo(`calc:${c.id}`, c.nombre)}
                              title={`${c.formula}`}
                              className="text-[11px] px-2 py-1 rounded border bg-[#eef2ff] border-[#c7d2fe] text-[#111] hover:border-[#3B63FB]"
                            >
                              {c.nombre || 'sin nombre'}
                              <span className="block text-[9px] opacity-60 font-mono">{c.formula}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {!catalogo && <p className="px-3 py-3 text-xs text-[#8a847a]">Cargando campos…</p>}
                  </div>
                  <p className="px-3 py-2 text-[10px] text-[#8a847a] border-t border-[#e6e1d8]">
                    Haz clic en un campo para crear un bloque con él.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {bloques.length === 0 && (
              <p className="text-[#6f6a62] text-sm md:col-span-2">Sin bloques. Añade un KPI para empezar.</p>
            )}

            {bloques.map((b, i) => {
              const total = valorDe(b, datos?.totales as Record<string, unknown> | null)
              const grande = b.tipo === 'serie' || b.tipo === 'tabla' || b.tipo === 'campanas'

              return (
                <div key={b.id} className={`border border-[#e6e1d8] rounded-xl p-4 ${grande ? 'md:col-span-2' : ''}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {editando ? (
                      <>
                        <input
                          value={b.titulo}
                          onChange={e => setBloques(prev => prev.map((x, j) => j === i ? { ...x, titulo: e.target.value } : x))}
                          className={`${input} text-sm`}
                        />
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <select
                            value={b.metrica}
                            onChange={e => {
                              const metrica = e.target.value as Metrica
                              setBloques(prev => prev.map((x, j) => j === i ? { ...x, metrica, titulo: METRICAS[metrica].label } : x))
                            }}
                            className="text-xs border border-[#d8d3c9] rounded px-1 py-1"
                          >
                            {Object.entries(METRICAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            {calculadas.length > 0 && (
                              <optgroup label="Calculadas">
                                {calculadas.map(c => <option key={c.id} value={`calc:${c.id}`}>{c.nombre}</option>)}
                              </optgroup>
                            )}
                          </select>
                          <select
                            value={b.formato ?? 'auto'}
                            onChange={e => setBloques(prev => prev.map((x, j) => j === i ? { ...x, formato: e.target.value as Bloque['formato'] } : x))}
                            className="text-xs border border-[#d8d3c9] rounded px-1 py-1"
                            title="Formato del número"
                          >
                            <option value="auto">Auto</option>
                            <option value="euro">€</option>
                            <option value="porcentaje">%</option>
                            <option value="numero">Número</option>
                            <option value="x">×</option>
                          </select>
                          <select
                            value={String(b.decimales ?? 2)}
                            onChange={e => setBloques(prev => prev.map((x, j) => j === i ? { ...x, decimales: Number(e.target.value) } : x))}
                            className="text-xs border border-[#d8d3c9] rounded px-1 py-1"
                            title="Decimales"
                          >
                            <option value="0">0 dec</option>
                            <option value="1">1 dec</option>
                            <option value="2">2 dec</option>
                          </select>
                          <button onClick={() => setBloques(prev => prev.filter((_, j) => j !== i))} className="text-red-600 text-xs px-1">✕</button>
                        </div>
                      </>
                    ) : (
                      <span className="text-[#6f6a62] text-sm">{b.titulo}</span>
                    )}
                  </div>

                  {b.tipo === 'kpi' && (() => {
                    const varPct = variacion(b, total)
                    return (
                      <div>
                        <p className="text-[42px] leading-none font-bold text-[#111]">
                          {typeof total === 'number' ? formatoDe(b)(total) : '—'}
                        </p>
                        {varPct !== null && (
                          <p className={`text-xs mt-2 ${varPct >= 0 ? 'text-[#0f7a3d]' : 'text-[#b91c1c]'}`}>
                            {varPct >= 0 ? '▲' : '▼'} {Math.abs(varPct).toFixed(1)} %
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  {b.tipo === 'serie' && (
                    <div className="flex items-end gap-1 h-32">
                      {meses.length === 0 && <span className="text-[#8a847a] text-sm">Sin datos en el periodo</span>}
                      {meses.map(m => {
                        const valores = meses.map(x => valorDe(b, x) ?? 0)
                        const max = Math.max(...valores, 1)
                        const v = valorDe(b, m) ?? 0
                        return (
                          <div key={String(m.mes)} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${m.mes}: ${formatoDe(b)(v)}`}>
                            <div className="w-full bg-[#3B63FB] rounded-t" style={{ height: `${Math.max((v / max) * 100, v > 0 ? 4 : 1)}%` }} />
                            <span className="text-[9px] text-[#8a847a]">{String(m.mes).slice(5)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {b.tipo === 'tabla' && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[#6f6a62] text-xs uppercase">
                          <th className="text-left py-1">Mes</th>
                          <th className="text-right py-1">{b.titulo}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meses.map(m => (
                          <tr key={String(m.mes)} className="border-t border-[#eeeae2]">
                            <td className="py-1 text-[#1f1e1c]">{String(m.mes)}</td>
                            <td className="py-1 text-right text-[#111]">{(() => { const v = valorDe(b, m); return v === null ? '—' : formatoDe(b)(v) })()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {b.tipo === 'kpis' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {(b.metricas ?? ['coste', 'conversiones', 'cpa', 'roas']).map(m => {
                        const sub: Bloque = { ...b, metrica: m }
                        const v = valorDe(sub, datos?.totales as Record<string, unknown> | null)
                        const varPct = variacion(sub, v)
                        return (
                          <div key={m} className="bg-[#f7f5f1] border border-[#e6e1d8] rounded-lg px-3 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-[#8a847a]">{METRICAS[m]?.label ?? m}</p>
                            <p className="text-xl font-bold text-[#111] mt-1 leading-tight">{v === null ? '—' : formatoDe(sub)(v)}</p>
                            {varPct !== null && (
                              <p className={`text-[10px] mt-1 ${varPct >= 0 ? 'text-[#0f7a3d]' : 'text-[#b91c1c]'}`}>
                                {varPct >= 0 ? '▲' : '▼'} {Math.abs(varPct).toFixed(1)} %
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {b.tipo === 'embudo' && (
                    <div className="flex flex-wrap items-stretch gap-2">
                      {(b.metricas ?? ['impresiones', 'clics', 'conversiones']).map((m, k, arr) => {
                        const sub: Bloque = { ...b, metrica: m }
                        const v = valorDe(sub, datos?.totales as Record<string, unknown> | null)
                        const prev = k > 0 ? valorDe({ ...b, metrica: arr[k - 1] }, datos?.totales as Record<string, unknown> | null) : null
                        const cr = v !== null && prev !== null && prev > 0 ? (v / prev) * 100 : null
                        return (
                          <div key={m} className="flex items-stretch gap-2">
                            {k > 0 && (
                              <div className="flex flex-col items-center justify-center px-1">
                                <span className="text-[10px] text-[#6f6a62]">{cr === null ? '' : `${cr.toFixed(1)} %`}</span>
                                <span className="text-[#c9c4bb]">→</span>
                              </div>
                            )}
                            <div className="bg-[#f7f5f1] border border-[#e6e1d8] rounded-lg px-4 py-3 min-w-32">
                              <p className="text-[10px] uppercase tracking-wide text-[#8a847a]">{METRICAS[m]?.label ?? m}</p>
                              <p className="text-lg font-bold text-[#111] mt-0.5">{v === null ? '—' : formatoDe(sub)(v)}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {b.tipo === 'campanas' && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[#6f6a62] text-xs uppercase">
                          <th className="text-left py-1">Campaña</th>
                          <th className="text-right py-1">Inversión</th>
                          <th className="text-right py-1">Conv.</th>
                          <th className="text-right py-1">CPA</th>
                          <th className="text-right py-1">ROAS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(datos?.porCampana ?? []).map((c, idx) => (
                          <tr key={idx} className="border-t border-[#eeeae2]">
                            <td className="py-1 text-[#1f1e1c] truncate max-w-72">{String(c.campana)}</td>
                            <td className="py-1 text-right text-[#111]">{Number(c.coste ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</td>
                            <td className="py-1 text-right text-[#111]">{Number(c.conversiones ?? 0).toFixed(1)}</td>
                            <td className="py-1 text-right text-[#111]">{c.cpa != null ? `${c.cpa} €` : '—'}</td>
                            <td className="py-1 text-right text-[#111]">{c.roas != null ? `${c.roas}×` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </div>

          {datos?.error && (
            <div className="px-6 py-3 border-t border-[#e6e1d8] text-xs">
              <span className="text-red-600">{datos.error}</span>
              {datos.error.includes('Google Ads') && (
                <a href={`/clientes/${idCliente}/hub`} className="ml-2 text-[#2c6fd0] underline">
                  Ir al hub a reconectar
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
