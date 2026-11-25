'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface Bloque {
  id: string
  tipo: 'kpi' | 'serie' | 'tabla' | 'campanas'
  titulo: string
  metrica: Metrica
}

export type Metrica = 'coste' | 'conversiones' | 'cpa' | 'roas' | 'clics' | 'impresiones' | 'ctr'

export interface Informe {
  id: string
  nombre: string
  descripcion: string | null
  tipo: string
  config: { bloques?: Bloque[] } | null
  publico: boolean
  orden: number
}

interface Datos {
  totales: Record<string, number | null> | null
  porMes: Record<string, number | string | null>[]
  porCampana: Record<string, number | string | null>[]
  motivo?: string
  error?: string
}

const METRICAS: Record<Metrica, { label: string; formato: (v: number) => string }> = {
  coste: { label: 'Inversión', formato: v => `${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €` },
  conversiones: { label: 'Conversiones', formato: v => v.toFixed(1) },
  cpa: { label: 'CPA', formato: v => `${v.toFixed(2)} €` },
  roas: { label: 'ROAS', formato: v => `${v.toFixed(2)}×` },
  clics: { label: 'Clics', formato: v => v.toLocaleString('es-ES', { maximumFractionDigits: 0 }) },
  impresiones: { label: 'Impresiones', formato: v => v.toLocaleString('es-ES', { maximumFractionDigits: 0 }) },
  ctr: { label: 'CTR', formato: v => `${v.toFixed(2)} %` },
}

const input = 'bg-white border border-[#d8d3c9] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none focus:border-[#3B63FB]'

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

  const informe = informes.find(i => i.id === activo) ?? null
  const [bloques, setBloques] = useState<Bloque[]>(informe?.config?.bloques ?? [])

  // Cargar métricas de Google Ads según el periodo
  useEffect(() => {
    const hoy = new Date()
    let desde: string
    let hasta = hoy.toISOString().slice(0, 10)
    if (periodo === '30d') desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    else if (periodo === 'mes') desde = `${hoy.toISOString().slice(0, 7)}-01`
    else desde = `${hoy.getFullYear()}-01-01`

    setCargando(true)
    fetch(`/api/informes/datos?id_cliente=${idCliente}&desde=${desde}&hasta=${hasta}`)
      .then(r => r.json())
      .then(d => setDatos(d))
      .catch(() => setDatos({ totales: null, porMes: [], porCampana: [], error: 'No se pudieron cargar los datos' }))
      .finally(() => setCargando(false))
  }, [idCliente, periodo])

  const seleccionar = (inf: Informe) => {
    setActivo(inf.id)
    setBloques(inf.config?.bloques ?? [])
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
        body: JSON.stringify({ config: { bloques } }),
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
            <div className="px-6 py-3 border-b border-[#e6e1d8] bg-[#f7f5f1] flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#6f6a62]">Añadir:</span>
              {([
                ['kpi', '· KPI'],
                ['serie', '▮ Serie mensual'],
                ['tabla', '▦ Tabla mensual'],
                ['campanas', '▤ Tabla de campañas'],
              ] as const).map(([t, label]) => (
                <button key={t} onClick={() => setBloques(prev => [...prev, nuevoBloque(t)])} className="bg-white border border-[#d8d3c9] rounded-lg px-3 py-1 text-xs font-medium text-[#111] hover:border-[#3B63FB]">
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {bloques.length === 0 && (
              <p className="text-[#6f6a62] text-sm md:col-span-2">Sin bloques. Añade un KPI para empezar.</p>
            )}

            {bloques.map((b, i) => {
              const total = datos?.totales?.[b.metrica]
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
                          </select>
                          <button onClick={() => setBloques(prev => prev.filter((_, j) => j !== i))} className="text-red-600 text-xs px-1">✕</button>
                        </div>
                      </>
                    ) : (
                      <span className="text-[#6f6a62] text-sm">{b.titulo}</span>
                    )}
                  </div>

                  {b.tipo === 'kpi' && (
                    <p className="text-3xl font-bold text-[#111]">
                      {typeof total === 'number' ? METRICAS[b.metrica].formato(total) : '—'}
                    </p>
                  )}

                  {b.tipo === 'serie' && (
                    <div className="flex items-end gap-1 h-32">
                      {meses.length === 0 && <span className="text-[#8a847a] text-sm">Sin datos en el periodo</span>}
                      {meses.map(m => {
                        const valores = meses.map(x => Number(x[b.metrica] ?? 0))
                        const max = Math.max(...valores, 1)
                        const v = Number(m[b.metrica] ?? 0)
                        return (
                          <div key={String(m.mes)} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${m.mes}: ${METRICAS[b.metrica].formato(v)}`}>
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
                          <th className="text-right py-1">{METRICAS[b.metrica].label}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meses.map(m => (
                          <tr key={String(m.mes)} className="border-t border-[#eeeae2]">
                            <td className="py-1 text-[#1f1e1c]">{String(m.mes)}</td>
                            <td className="py-1 text-right text-[#111]">{METRICAS[b.metrica].formato(Number(m[b.metrica] ?? 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

          {datos?.error && <p className="px-6 py-3 text-red-600 text-xs border-t border-[#e6e1d8]">{datos.error}</p>}
        </div>
      )}
    </div>
  )
}
