'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { evaluarFormula, variablesDeFila } from '@/lib/informes/formula'

export interface Bloque {
  id: string
  tipo: 'kpi' | 'serie' | 'tabla' | 'campanas' | 'kpis' | 'embudo' | 'texto' | 'imagen'
  titulo: string
  metrica: Metrica
  metricas?: Metrica[]
  fuente?: 'google_ads' | 'ga4'
  formato?: 'auto' | 'euro' | 'porcentaje' | 'numero' | 'x'
  decimales?: number
  // Lienzo libre
  x?: number
  y?: number
  w?: number
  h?: number
  bg?: string
  color?: string
  tamano?: number
  texto?: string
  negrita?: boolean
  alineacion?: 'izquierda' | 'centro' | 'derecha'
  src?: string
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

export interface Pagina {
  id: string
  nombre: string
  bloques: Bloque[]
}

export interface Informe {
  id: string
  nombre: string
  descripcion: string | null
  tipo: string
  config: { bloques?: Bloque[]; calculadas?: Calculada[]; paginas?: Pagina[] } | null
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
  const [sel, setSel] = useState<string[]>([])
  const [guia, setGuia] = useState<{ x?: number; y?: number }>({})

  const alternarSel = (id: string, conMayus: boolean) => {
    setSel(prev => {
      if (!conMayus) return [id]
      return prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    })
  }
  const [drag, setDrag] = useState<null | {
    id: string; modo: 'mover' | 'tamano'
    ox: number; oy: number; x: number; y: number; w: number; h: number
  }>(null)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [datosGa4, setDatosGa4] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [periodo, setPeriodo] = useState<'30d' | 'mes' | 'ano'>('30d')
  const [catalogo, setCatalogo] = useState<{ fuentes: FuenteCatalogo[]; campos: CampoCatalogo[] } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [destino, setDestino] = useState<number>(-1)
  const [fuente, setFuente] = useState<'google_ads' | 'ga4'>('google_ads')

  const informe = informes.find(i => i.id === activo) ?? null
  const [paginas, setPaginas] = useState<Pagina[]>(
    informe?.config?.paginas
      ?? [{ id: 'p1', nombre: 'Página 1', bloques: informe?.config?.bloques ?? [] }],
  )
  const [paginaActiva, setPaginaActiva] = useState(0)

  const bloques = paginas[paginaActiva]?.bloques ?? []

  function setBloques(acc: Bloque[] | ((prev: Bloque[]) => Bloque[])) {
    setPaginas(prev => prev.map((pg, i) => {
      if (i !== paginaActiva) return pg
      const nuevos = typeof acc === 'function' ? acc(pg.bloques) : acc
      return { ...pg, bloques: nuevos }
    }))
  }
  const [calculadas, setCalculadas] = useState<Calculada[]>(informe?.config?.calculadas ?? [])

  // Métricas de GA4 que usan los bloques marcados como GA4
  const metricasGA4 = useMemo(() => {
    const base = new Set(Object.keys(METRICAS))
    const usadas = bloques
      .filter(b => b.fuente === 'ga4')
      .map(b => b.metrica)
      .filter(m => !m.startsWith('calc:') && !base.has(m))
    return [...new Set(usadas)]
  }, [bloques])

  const rango = useMemo(() => {
    const hoy = new Date()
    let desde: string
    const hasta = hoy.toISOString().slice(0, 10)
    if (periodo === '30d') desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    else if (periodo === 'mes') desde = `${hoy.toISOString().slice(0, 7)}-01`
    else desde = `${hoy.getFullYear()}-01-01`
    return { desde, hasta }
  }, [periodo])

  // Google Ads (siempre disponible)
  useEffect(() => {
    setCargando(true)
    fetch(`/api/informes/datos?id_cliente=${idCliente}&fuente=google_ads&desde=${rango.desde}&hasta=${rango.hasta}`)
      .then(r => r.json())
      .then(d => setDatos(d))
      .catch(() => setDatos({ totales: null, porMes: [], porCampana: [], error: 'No se pudieron cargar los datos' }))
      .finally(() => setCargando(false))
  }, [idCliente, rango.desde, rango.hasta])

  // GA4 (solo si hay bloques de GA4)
  useEffect(() => {
    if (metricasGA4.length === 0) { setDatosGa4(null); return }
    fetch(`/api/informes/datos?id_cliente=${idCliente}&fuente=ga4&desde=${rango.desde}&hasta=${rango.hasta}&metricas=${encodeURIComponent(metricasGA4.join(','))}`)
      .then(r => r.json())
      .then(d => setDatosGa4(d))
      .catch(() => setDatosGa4({ totales: null, porMes: [], porCampana: [], error: 'No se pudieron cargar los datos de GA4' }))
  }, [idCliente, rango.desde, rango.hasta, metricasGA4.join(',')])

  useEffect(() => {
    fetch(`/api/informes/campos?id_cliente=${idCliente}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setCatalogo(d))
      .catch(() => setCatalogo(null))
  }, [idCliente])

  const snap = (v: number) => Math.round(v / 8) * 8

  const geo = (b: Bloque, i: number) => ({
    x: b.x ?? 16 + (i % 3) * 300,
    y: b.y ?? 16 + Math.floor(i / 3) * 150,
    w: b.w ?? 280,
    h: b.h ?? 130,
  })

  const anadirBloqueDeCampo = (metrica: string, etiqueta: string, fuenteCampo: 'google_ads' | 'ga4') => {
    const i = bloques.length
    setBloques(prev => [...prev, {
      id: crypto.randomUUID(),
      tipo: 'kpi',
      titulo: etiqueta,
      metrica: metrica as Metrica,
      fuente: fuenteCampo,
      x: 16 + (i % 3) * 300,
      y: 16 + Math.floor(i / 3) * 150,
      w: 280,
      h: 130,
    }])
  }

  const anadirTexto = () => {
    const i = bloques.length
    setBloques(prev => [...prev, {
      id: crypto.randomUUID(),
      tipo: 'texto',
      titulo: '',
      metrica: 'coste' as Metrica,
      texto: 'Escribe aquí',
      x: 16 + (i % 3) * 300,
      y: 16 + Math.floor(i / 3) * 150,
      w: 280,
      h: 80,
      bg: 'transparent',
    }])
  }

  const anadirImagen = () => {
    const i = bloques.length
    setBloques(prev => [...prev, {
      id: crypto.randomUUID(),
      tipo: 'imagen',
      titulo: '',
      metrica: 'coste' as Metrica,
      src: '',
      x: 16 + (i % 3) * 300,
      y: 16 + Math.floor(i / 3) * 150,
      w: 240,
      h: 120,
      bg: 'transparent',
    }])
  }

  const alMover = (e: React.PointerEvent) => {
    if (!drag) return
    const dx = e.clientX - drag.ox
    const dy = e.clientY - drag.oy
    setBloques(prev => prev.map(b => {
      if (b.id !== drag.id) return b
      if (drag.modo === 'mover') {
        let x = Math.max(0, snap(drag.x + dx))
        let y = Math.max(0, snap(drag.y + dy))
        const gx: number[] = [0]
        const gy: number[] = [0]
        for (const otro of prev) {
          if (otro.id === b.id) continue
          const j = prev.indexOf(otro)
          const g = geo(otro, j)
          gx.push(g.x, g.x + g.w, g.x + g.w / 2)
          gy.push(g.y, g.y + g.h, g.y + g.h / 2)
        }
        const cerca = (v: number, lista: number[]) => lista.find(c => Math.abs(c - v) <= 6)
        const sx = cerca(x, gx) ?? cerca(x + (b.w ?? 280), gx)
        const sy = cerca(y, gy) ?? cerca(y + (b.h ?? 130), gy)
        if (sx !== undefined) x = sx === 0 ? 0 : x + (sx - x)
        if (sy !== undefined) y = sy === 0 ? 0 : y + (sy - y)
        setGuia({ x: sx, y: sy })
        return { ...b, x, y }
      }
      return { ...b, w: Math.max(140, snap(drag.w + dx)), h: Math.max(80, snap(drag.h + dy)) }
    }))
  }

  const seleccionar = (inf: Informe) => {
    setActivo(inf.id)
    setPaginas(inf.config?.paginas ?? [{ id: 'p1', nombre: 'Página 1', bloques: inf.config?.bloques ?? [] }])
    setPaginaActiva(0)
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
        body: JSON.stringify({ config: { paginas, calculadas } }),
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

  const mesesDe = (b: Bloque) => (b.fuente === 'ga4' ? datosGa4?.porMes : datos?.porMes) ?? []

  // Valor de un bloque para una fila (mes) o para los totales
  const datosDe = (b: Bloque) => (b.fuente === 'ga4' ? datosGa4 : datos)

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
    const previo = valorDe(b, datosDe(b)?.anterior as Record<string, unknown> | null)
    if (previo === null || previo === 0) return null
    return ((actual - previo) / Math.abs(previo)) * 100
  }

  const etiquetaDe = (metrica: string) => {
    if (metrica.startsWith('calc:')) return calculadas.find(c => `calc:${c.id}` === metrica)?.nombre ?? metrica
    return METRICAS[metrica as Metrica]?.label
      ?? (catalogo?.campos ?? []).find(c => c.variable === metrica)?.etiqueta
      ?? metrica
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
    const delCatalogo = (catalogo?.campos ?? []).find(c => c.variable === b.metrica)?.etiqueta
    if (delCatalogo) {
      return (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec })
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
                {bloques.length} bloques · {paginas[paginaActiva]?.nombre} {cargando ? '· cargando…' : datos?.motivo ? `· ${datos.motivo}` : ''}
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

          <div className="lg:flex lg:items-start">
            <div className="flex-1 min-w-0">
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
                ['texto', 'T Texto'],
                ['imagen', '🖼 Imagen'],
              ] as const).map(([t, label]) => (
                <button key={t} onClick={() => { if (t === 'texto') { anadirTexto(); return } if (t === 'imagen') { anadirImagen(); return } setBloques(prev => [...prev, nuevoBloque(t)]) }} className="bg-white border border-[#d8d3c9] rounded-lg px-3 py-1 text-xs font-medium text-[#111] hover:border-[#3B63FB]">
                  {label}
                </button>
              ))}
              </div>

              {/* Métricas calculadas (con hueco para el cajón lateral) */}
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

                
              </div>
            </div>
          )}

          <div className="mx-4 mt-4 flex items-center gap-2 flex-wrap">
            {paginas.map((pg, i) => (
              <button
                key={pg.id}
                onClick={() => { setPaginaActiva(i); setSel([]) }}
                onDoubleClick={() => {
                  const nombre = prompt('Nombre de la página', pg.nombre)
                  if (nombre) setPaginas(prev => prev.map((x, j) => j === i ? { ...x, nombre } : x))
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  i === paginaActiva
                    ? 'bg-[#111] text-white border-[#111]'
                    : 'bg-white text-[#1f1e1c] border-[#d8d3c9] hover:border-[#3B63FB]'
                }`}
                title="Doble clic para renombrar"
              >
                {pg.nombre}
              </button>
            ))}

            {editando && (
              <button
                onClick={() => {
                  setPaginas(prev => [...prev, { id: crypto.randomUUID(), nombre: `Página ${prev.length + 1}`, bloques: [] }])
                  setPaginaActiva(paginas.length)
                  setSel([])
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-dashed border-[#d8d3c9] text-[#111] hover:border-[#3B63FB]"
              >
                + Página
              </button>
            )}

            {editando && paginas.length > 1 && (
              <button
                onClick={() => {
                  const resto = paginas.filter((_, j) => j !== paginaActiva)
                  setPaginas(resto)
                  setPaginaActiva(Math.max(0, paginaActiva - 1))
                  setSel([])
                }}
                className="ml-auto text-xs text-red-600"
              >
                Quitar esta página
              </button>
            )}
          </div>

          {editando && sel.length > 0 && (() => {
            const b = bloques.find(x => x.id === sel[0])
            if (!b) return null

            // Varios seleccionados: alinear
            if (sel.length > 1) {
              const alinear = (modo: 'izq' | 'centro' | 'der' | 'arriba' | 'medio' | 'abajo') => {
                setBloques(prev => {
                  const puntos = sel
                    .map(id => { const idx = prev.findIndex(x => x.id === id); return { idx, g: idx >= 0 ? geo(prev[idx], idx) : null } })
                    .filter(x => x.g) as { idx: number; g: { x: number; y: number; w: number; h: number } }[]
                  if (puntos.length === 0) return prev
                  const minX = Math.min(...puntos.map(p => p.g.x))
                  const maxX = Math.max(...puntos.map(p => p.g.x + p.g.w))
                  const minY = Math.min(...puntos.map(p => p.g.y))
                  const maxY = Math.max(...puntos.map(p => p.g.y + p.g.h))
                  const ancho = maxX - minX
                  const copia = prev.map(x => ({ ...x }))
                  for (const pto of puntos) {
                    const x = copia[pto.idx]
                    if (modo === 'izq') x.x = minX
                    if (modo === 'der') x.x = maxX - pto.g.w
                    if (modo === 'centro') x.x = Math.round(minX + (ancho - pto.g.w) / 2)
                    if (modo === 'arriba') x.y = minY
                    if (modo === 'abajo') x.y = maxY - pto.g.h
                    if (modo === 'medio') x.y = Math.round(minY + (maxY - minY - pto.g.h) / 2)
                  }
                  return copia
                })
              }

              return (
                <div className="m-4 mb-0 flex flex-wrap items-center gap-2 bg-[#f7f5f1] border border-[#e6e1d8] rounded-lg px-3 py-2">
                  <span className="text-xs text-[#6f6a62]">{sel.length} bloques:</span>
                  <button onClick={() => alinear('izq')} className="text-xs px-2 py-1 rounded bg-white border border-[#d8d3c9] text-[#111]">Alinear izquierda</button>
                  <button onClick={() => alinear('centro')} className="text-xs px-2 py-1 rounded bg-white border border-[#d8d3c9] text-[#111]">Centrar</button>
                  <button onClick={() => alinear('der')} className="text-xs px-2 py-1 rounded bg-white border border-[#d8d3c9] text-[#111]">Alinear derecha</button>
                  <button onClick={() => alinear('arriba')} className="text-xs px-2 py-1 rounded bg-white border border-[#d8d3c9] text-[#111]">Arriba</button>
                  <button onClick={() => alinear('medio')} className="text-xs px-2 py-1 rounded bg-white border border-[#d8d3c9] text-[#111]">Centro vertical</button>
                  <button onClick={() => alinear('abajo')} className="text-xs px-2 py-1 rounded bg-white border border-[#d8d3c9] text-[#111]">Abajo</button>
                  <button
                    onClick={() => { setBloques(prev => prev.filter(x => !sel.includes(x.id))); setSel([]) }}
                    className="ml-auto text-red-600 text-xs"
                  >
                    Quitar {sel.length}
                  </button>
                </div>
              )
            }

            return (
              <div className="m-4 mb-0 flex flex-wrap items-center gap-3 bg-[#f7f5f1] border border-[#e6e1d8] rounded-lg px-3 py-2">
                <span className="text-xs text-[#6f6a62]">Bloque:</span>
                <label className="flex items-center gap-1 text-xs text-[#1f1e1c]">
                  Fondo
                  <input type="color" value={b.bg ?? '#ffffff'}
                    onChange={e => setBloques(prev => prev.map(x => x.id === b.id ? { ...x, bg: e.target.value } : x))}
                    className="w-7 h-6 rounded border border-[#d8d3c9] bg-transparent" />
                </label>
                <div className="flex items-center gap-1">
                  {['#ffffff', '#f3f1ec', '#111111', '#3B63FB', '#0f7a3d', '#b91c1c', '#C9A227', '#6b7280'].map(c => (
                    <button
                      key={c}
                      onClick={() => setBloques(prev => prev.map(x => x.id === b.id ? { ...x, bg: c } : x))}
                      title={`Fondo ${c}`}
                      className="w-5 h-5 rounded border border-[#d8d3c9]"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => {
                    const idx = bloques.findIndex(x => x.id === b.id)
                    const g = geo(b, idx)
                    const copia = { ...b, id: crypto.randomUUID(), x: g.x + 24, y: g.y + 24 }
                    setBloques(prev => [...prev, copia])
                    setSel([copia.id])
                  }}
                  className="text-xs px-2 py-1 rounded bg-white border border-[#d8d3c9] text-[#111]"
                >
                  Duplicar
                </button>
                {b.tipo === 'imagen' && (
                  <input
                    value={b.src ?? ''}
                    onChange={e => setBloques(prev => prev.map(x => x.id === b.id ? { ...x, src: e.target.value } : x))}
                    placeholder="URL de la imagen"
                    className="text-xs border border-[#d8d3c9] rounded px-2 py-1 w-56"
                  />
                )}
                <label className="flex items-center gap-1 text-xs text-[#1f1e1c]">
                  Texto
                  <input type="color" value={b.color ?? '#111111'}
                    onChange={e => setBloques(prev => prev.map(x => x.id === b.id ? { ...x, color: e.target.value } : x))}
                    className="w-7 h-6 rounded border border-[#d8d3c9] bg-transparent" />
                </label>
                <label className="flex items-center gap-1 text-xs text-[#1f1e1c]">
                  Tamaño
                  <select value={String(b.tamano ?? 0)}
                    onChange={e => setBloques(prev => prev.map(x => x.id === b.id ? { ...x, tamano: Number(e.target.value) } : x))}
                    className="text-xs border border-[#d8d3c9] rounded px-1 py-1">
                    <option value="0">Normal</option>
                    <option value="14">Pequeño</option>
                    <option value="20">Grande</option>
                    <option value="28">Muy grande</option>
                  </select>
                </label>
                {b.tipo === 'texto' && (
                  <>
                    <button
                      onClick={() => setBloques(prev => prev.map(x => x.id === b.id ? { ...x, negrita: !x.negrita } : x))}
                      className={`text-xs px-2 py-1 rounded border ${b.negrita ? 'bg-[#111] text-white border-[#111]' : 'bg-white border-[#d8d3c9] text-[#111]'}`}
                    >
                      N
                    </button>
                    <select
                      value={b.alineacion ?? 'izquierda'}
                      onChange={e => setBloques(prev => prev.map(x => x.id === b.id ? { ...x, alineacion: e.target.value as 'izquierda' | 'centro' | 'derecha' } : x))}
                      className="text-xs border border-[#d8d3c9] rounded px-1 py-1"
                    >
                      <option value="izquierda">Izquierda</option>
                      <option value="centro">Centro</option>
                      <option value="derecha">Derecha</option>
                    </select>
                  </>
                )}
                <span className="text-[10px] text-[#8a847a]">Arrastra para mover · ◢ para redimensionar</span>
                <button
                  onClick={() => { setBloques(prev => prev.filter(x => x.id !== b.id)); setSel([]) }}
                  className="ml-auto text-red-600 text-xs"
                >
                  Quitar bloque
                </button>
              </div>
            )
          })()}

          <div
            className="relative m-4 bg-[#faf8f4] border border-[#e6e1d8] rounded-xl overflow-hidden select-none"
            style={{ height: Math.max(320, ...bloques.map((b, i) => geo(b, i).y + geo(b, i).h + 24)) }}
            onPointerMove={alMover}
            onPointerUp={() => { setDrag(null); setGuia({}) }}
            onPointerLeave={() => setDrag(null)}
            onClick={() => setSel([])}
          >
            {guia.x !== undefined && (
              <div className="absolute top-0 bottom-0 w-px bg-[#3B63FB] pointer-events-none" style={{ left: guia.x }} />
            )}
            {guia.y !== undefined && (
              <div className="absolute left-0 right-0 h-px bg-[#3B63FB] pointer-events-none" style={{ top: guia.y }} />
            )}

            {bloques.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-[#8a847a] text-sm">
                Sin bloques. Añade un campo desde la derecha.
              </p>
            )}

            {bloques.map((b, i) => {
              const total = valorDe(b, datosDe(b)?.totales as Record<string, unknown> | null)
              const grande = b.tipo === 'serie' || b.tipo === 'tabla' || b.tipo === 'campanas'

              return (
                <div
                  key={b.id}
                  onClick={e => { e.stopPropagation(); alternarSel(b.id, e.metaKey || e.ctrlKey || e.shiftKey) }}
                  className={`informe-bloque absolute rounded-xl p-3 overflow-hidden ${sel.includes(b.id) ? 'ring-2 ring-[#3B63FB]' : 'border border-[#e6e1d8]'} ${editando ? 'cursor-move' : ''}`}
                  style={{
                    left: geo(b, i).x,
                    top: geo(b, i).y,
                    width: geo(b, i).w,
                    height: geo(b, i).h,
                    background: b.bg ?? '#ffffff',
                    color: b.color ?? '#111111',
                    fontSize: b.tamano ? `${b.tamano}px` : undefined,
                  }}
                  onPointerDown={e => {
                    if (!editando) return
                    const g = geo(b, i)
                    setDrag({ id: b.id, modo: 'mover', ox: e.clientX, oy: e.clientY, ...g })
                  }}
                >
                  {editando && (
                    <div
                      className="absolute right-1 bottom-1 w-4 h-4 cursor-se-resize text-[#8a847a] text-[10px] leading-none flex items-center justify-center"
                      onPointerDown={e => {
                        e.stopPropagation()
                        const g = geo(b, i)
                        setDrag({ id: b.id, modo: 'tamano', ox: e.clientX, oy: e.clientY, ...g })
                      }}
                    >
                      ◢
                    </div>
                  )}
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
                              const etiqueta = METRICAS[metrica]?.label
                                ?? (catalogo?.campos ?? []).find(c => c.variable === metrica)?.etiqueta
                                ?? metrica
                              setBloques(prev => prev.map((x, j) => j === i ? { ...x, metrica, titulo: etiqueta } : x))
                            }}
                            className="text-xs border border-[#d8d3c9] rounded px-1 py-1"
                          >
                            <optgroup label="Google Ads">
                              {Object.entries(METRICAS).filter(([k]) => !['sesiones','usuarios','carritos','compras','ingresos','aov','cr'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </optgroup>
                            {(catalogo?.campos ?? []).filter(c => c.fuente === 'ga4').length > 0 && (
                              <optgroup label="GA4">
                                {(catalogo?.campos ?? []).filter(c => c.fuente === 'ga4' && c.tipo === 'metrica').map(c => (
                                  <option key={c.variable} value={c.variable}>{c.etiqueta}</option>
                                ))}
                              </optgroup>
                            )}
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

                  {b.tipo === 'imagen' && (
                    b.src
                      ? <img src={b.src} alt="" className="w-full h-full object-contain" draggable={false} />
                      : <div className="w-full h-full flex items-center justify-center text-[11px] text-[#8a847a] border border-dashed border-[#d8d3c9] rounded">
                          Pega una URL de imagen arriba
                        </div>
                  )}

                  {b.tipo === 'texto' && (
                    editando ? (
                      <textarea
                        value={b.texto ?? ''}
                        onChange={e => setBloques(prev => prev.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))}
                        onPointerDown={e => e.stopPropagation()}
                        className="w-full h-full bg-transparent border-0 outline-none resize-none"
                        style={{ fontWeight: b.negrita ? 700 : 400, textAlign: b.alineacion === 'centro' ? 'center' : b.alineacion === 'derecha' ? 'right' : 'left' }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap" style={{ fontWeight: b.negrita ? 700 : 400, textAlign: b.alineacion === 'centro' ? 'center' : b.alineacion === 'derecha' ? 'right' : 'left' }}>
                        {b.texto}
                      </p>
                    )
                  )}

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
                      {mesesDe(b).length === 0 && <span className="text-[#8a847a] text-sm">Sin datos en el periodo</span>}
                      {mesesDe(b).map(m => {
                        const valores = mesesDe(b).map(x => valorDe(b, x) ?? 0)
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
                        {mesesDe(b).map(m => (
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
                        const v = valorDe(sub, datosDe(sub)?.totales as Record<string, unknown> | null)
                        const varPct = variacion(sub, v)
                        return (
                          <div key={m} className="bg-[#f7f5f1] border border-[#e6e1d8] rounded-lg px-3 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-[#8a847a]">{etiquetaDe(m)}</p>
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
                        const v = valorDe(sub, datosDe(sub)?.totales as Record<string, unknown> | null)
                        const prev = k > 0 ? valorDe({ ...b, metrica: arr[k - 1] }, datosDe(b)?.totales as Record<string, unknown> | null) : null
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
                              <p className="text-[10px] uppercase tracking-wide text-[#8a847a]">{etiquetaDe(m)}</p>
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
{/* Panel de campos disponibles */}
                <div className="mt-3 lg:mt-0 lg:w-72 shrink-0 lg:sticky lg:top-4 border border-[#d8d3c9] lg:border-0 lg:border-l lg:rounded-none rounded-lg bg-white overflow-hidden flex flex-col lg:max-h-[calc(100vh-2rem)]">
                  <div className="px-3 py-2 border-b border-[#e6e1d8] flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#111]">Campos disponibles</span>
                    <input
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      placeholder="Buscar campo…"
                      className="ml-auto text-xs border border-[#d8d3c9] rounded px-2 py-1 w-40"
                    />
                  </div>
                  <div className="max-h-56 lg:max-h-none lg:flex-1 overflow-y-auto overflow-x-hidden divide-y divide-[#f0ece4]">
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
                          <div className="flex flex-wrap gap-1 px-3 py-2 min-w-0">
                            {campos.map(c => (
                              <button
                                key={c.variable}
                                onClick={() => anadirBloqueDeCampo(c.variable, c.etiqueta, f.id as 'google_ads' | 'ga4')}
                                title={f.conectada ? `${c.variable} — clic para insertar` : `${c.variable} — falta conectar ${f.nombre}`}
                                className={`text-[11px] px-2 py-1 rounded border text-left max-w-full break-words leading-tight ${
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
                        <div className="flex flex-wrap gap-1 px-3 py-2 min-w-0">
                          {calculadas.map(c => (
                            <button
                              key={c.id}
                              onClick={() => anadirBloqueDeCampo(`calc:${c.id}`, c.nombre, fuente)}
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
    </div>
  )
}
