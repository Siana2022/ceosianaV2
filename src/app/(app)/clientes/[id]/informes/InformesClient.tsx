'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface SerieMes {
  mes: number
  facturado: number
  horas: number
  tareas: number
}

export interface Bloque {
  id: string
  tipo: 'kpi' | 'serie' | 'tabla'
  titulo: string
  metrica: 'facturado' | 'horas' | 'tareas'
  estilo?: 'barras' | 'linea'
}

export interface Informe {
  id: string
  nombre: string
  descripcion: string | null
  tipo: string
  config: { bloques?: Bloque[] } | null
  publico: boolean
  orden: number
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const METRICAS: Record<string, { label: string; formato: (v: number) => string }> = {
  facturado: { label: 'Facturación', formato: v => `${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €` },
  horas: { label: 'Horas fichadas', formato: v => `${v.toFixed(1)} h` },
  tareas: { label: 'Tareas creadas', formato: v => `${Math.round(v)}` },
}

const input = 'w-full bg-white border border-[#d8d3c9] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none focus:border-[#3B63FB]'

function nuevoBloque(metrica: Bloque['metrica'] = 'facturado'): Bloque {
  return {
    id: crypto.randomUUID(),
    tipo: 'kpi',
    titulo: METRICAS[metrica].label,
    metrica,
    estilo: 'barras',
  }
}

export default function InformesClient({
  idCliente, year, serie, informes, esAdmin,
}: {
  idCliente: string
  year: number
  serie: SerieMes[]
  informes: Informe[]
  esAdmin: boolean
}) {
  const router = useRouter()
  const [activo, setActivo] = useState<string | null>(informes[0]?.id ?? null)
  const [editando, setEditando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)

  const informe = informes.find(i => i.id === activo) ?? null
  const [bloques, setBloques] = useState<Bloque[]>(informe?.config?.bloques ?? [])

  const totales = useMemo(() => ({
    facturado: serie.reduce((t, m) => t + m.facturado, 0),
    horas: serie.reduce((t, m) => t + m.horas, 0),
    tareas: serie.reduce((t, m) => t + m.tareas, 0),
  }), [serie])

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
      if (res.ok) {
        setNombreNuevo('')
        router.refresh()
      }
    } finally {
      setGuardando(false)
    }
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
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async () => {
    if (!informe) return
    await fetch(`/api/informes?id=${informe.id}`, { method: 'DELETE' })
    setActivo(null)
    router.refresh()
  }

  const anadirBloque = (tipo: Bloque['tipo']) => {
    const b = nuevoBloque()
    b.tipo = tipo
    setBloques(prev => [...prev, b])
  }

  return (
    <div className="space-y-5">
      {/* Selector de informes */}
      <div className="flex items-center gap-2 flex-wrap">
        {informes.map(inf => (
          <button
            key={inf.id}
            onClick={() => seleccionar(inf)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              inf.id === activo
                ? 'bg-[#3B63FB] text-white border-[#3B63FB]'
                : 'bg-white text-[#1f1e1c] border-[#d8d3c9] hover:border-[#3B63FB]'
            }`}
          >
            {inf.nombre}
          </button>
        ))}

        {esAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            <input
              value={nombreNuevo}
              onChange={e => setNombreNuevo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void crear() }}
              placeholder="Nuevo informe…"
              className={`${input} w-52`}
            />
            <button
              onClick={crear}
              disabled={guardando || !nombreNuevo.trim()}
              className="bg-[#111] text-white rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40"
            >
              + Crear
            </button>
          </div>
        )}
      </div>

      {!informe && (
        <div className="bg-white border border-[#dcd7cd] rounded-xl p-8 text-center text-[#6f6a62] text-sm">
          Todavía no hay informes. Crea uno para empezar a montar el dashboard de {year}.
        </div>
      )}

      {informe && (
        <div className="bg-white border border-[#dcd7cd] rounded-xl">
          <div className="px-6 py-4 border-b border-[#e6e1d8] flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-[#111] font-semibold">{informe.nombre}</h3>
              <p className="text-[#6f6a62] text-xs mt-0.5">
                {bloques.length} bloques · {informe.tipo}
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
                    <button onClick={() => setEditando(true)} className="bg-[#111] text-white rounded-lg px-3 py-1.5 text-sm font-medium">
                      Editar bloques
                    </button>
                    <button onClick={borrar} className="text-red-600 text-sm px-2">Borrar</button>
                  </>
                )}
              </div>
            )}
          </div>

          {editando && (
            <div className="px-6 py-3 border-b border-[#e6e1d8] bg-[#f7f5f1] flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#6f6a62]">Añadir:</span>
              {(['kpi', 'serie', 'tabla'] as const).map(t => (
                <button key={t} onClick={() => anadirBloque(t)} className="bg-white border border-[#d8d3c9] rounded-lg px-3 py-1 text-xs font-medium text-[#111] hover:border-[#3B63FB]">
                  {t === 'kpi' ? '· KPI' : t === 'serie' ? '▮ Serie' : '▦ Tabla'}
                </button>
              ))}
            </div>
          )}

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {bloques.length === 0 && (
              <p className="text-[#6f6a62] text-sm md:col-span-2">
                Sin bloques. {esAdmin ? 'Pulsa “Editar bloques” y añade un KPI.' : ''}
              </p>
            )}

            {bloques.map((b, i) => (
              <div key={b.id} className={`border border-[#e6e1d8] rounded-xl p-4 ${b.tipo === 'serie' || b.tipo === 'tabla' ? 'md:col-span-2' : ''}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  {editando ? (
                    <input
                      value={b.titulo}
                      onChange={e => setBloques(prev => prev.map((x, j) => j === i ? { ...x, titulo: e.target.value } : x))}
                      className={`${input} text-sm`}
                    />
                  ) : (
                    <span className="text-[#6f6a62] text-sm">{b.titulo}</span>
                  )}
                  {editando && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <select
                        value={b.metrica}
                        onChange={e => {
                          const metrica = e.target.value as Bloque['metrica']
                          setBloques(prev => prev.map((x, j) => j === i ? { ...x, metrica, titulo: METRICAS[metrica].label } : x))
                        }}
                        className="text-xs border border-[#d8d3c9] rounded px-1 py-1"
                      >
                        {Object.entries(METRICAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <button onClick={() => setBloques(prev => prev.filter((_, j) => j !== i))} className="text-red-600 text-xs px-1">✕</button>
                    </div>
                  )}
                </div>

                {b.tipo === 'kpi' && (
                  <p className="text-3xl font-bold text-[#111]">{METRICAS[b.metrica].formato(totales[b.metrica])}</p>
                )}

                {b.tipo === 'serie' && (
                  <div className="flex items-end gap-1 h-32">
                    {serie.map((m, idx) => {
                      const max = Math.max(...serie.map(x => x[b.metrica]), 1)
                      const alto = Math.max((m[b.metrica] / max) * 100, m[b.metrica] > 0 ? 4 : 1)
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${MESES[idx]}: ${METRICAS[b.metrica].formato(m[b.metrica])}`}>
                          <div className="w-full bg-[#3B63FB] rounded-t" style={{ height: `${alto}%` }} />
                          <span className="text-[9px] text-[#8a847a]">{MESES[idx]}</span>
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
                      {serie.filter(m => m[b.metrica] > 0).map(m => (
                        <tr key={m.mes} className="border-t border-[#eeeae2]">
                          <td className="py-1 text-[#1f1e1c]">{MESES[m.mes - 1]}</td>
                          <td className="py-1 text-right text-[#111]">{METRICAS[b.metrica].formato(m[b.metrica])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
