'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { RendimientoRow } from './page'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

const fmtH = (h: number) => {
  if (h === 0) return '—'
  if (h < 1) return `${Math.round(h * 60)}m`
  return `${h.toFixed(1)}h`
}

const fmtEH = (euros: number, horas: number) =>
  horas > 0 ? fmt(euros / horas) + '/h' : '—'

interface Props {
  rows: RendimientoRow[]
  anio: number
  years: number[]
}

function MargenBadge({ coste, facturacion }: { coste: number; facturacion: number }) {
  const margen = facturacion - coste
  const pct = facturacion > 0 ? (margen / facturacion) * 100 : null
  if (facturacion === 0) return <span className="text-gray-600">—</span>
  return (
    <div>
      <span className={`font-medium ${margen >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(margen)}</span>
      {pct !== null && (
        <span className={`block text-[11px] ${margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pct.toFixed(1)}%</span>
      )}
    </div>
  )
}

// ─── POR EMPLEADO ─────────────────────────────────────────────────────────────
function TabPorEmpleado({ rows, mes }: { rows: RendimientoRow[]; mes: number | null }) {
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null)

  const filtered = useMemo(() =>
    mes ? rows.filter(r => r.mes === mes) : rows,
    [rows, mes]
  )

  // Aggregate by employee
  const byEmp = useMemo(() => {
    const map = new Map<string, { nombre: string; coste: number; horas: number; facturacion: number; proyectos: Set<string> }>()
    for (const r of filtered) {
      if (!map.has(r.empId)) map.set(r.empId, { nombre: r.empNombre, coste: 0, horas: 0, facturacion: 0, proyectos: new Set() })
      const e = map.get(r.empId)!
      e.coste += r.costeAsignado
      e.horas += r.horasFichadas
      e.facturacion += r.facturacion
      e.proyectos.add(r.servicioId)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].facturacion - a[1].facturacion)
  }, [filtered])

  // Detail rows for selected employee
  const empRows = useMemo(() =>
    filtered.filter(r => r.empId === selectedEmp).sort((a, b) => a.mes - b.mes || a.clienteNombre.localeCompare(b.clienteNombre)),
    [filtered, selectedEmp]
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT: employee list */}
      <div className="lg:col-span-5 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Empleados</h3>
          <p className="text-gray-500 text-xs mt-0.5">Selecciona uno para ver el detalle por proyecto</p>
        </div>
        <div className="divide-y divide-gray-800/50">
          {byEmp.map(([empId, data]) => {
            const margen = data.facturacion - data.coste
            const isSelected = selectedEmp === empId
            return (
              <button key={empId} onClick={() => setSelectedEmp(isSelected ? null : empId)}
                className={`w-full text-left px-6 py-4 hover:bg-gray-800/30 transition-colors ${isSelected ? 'bg-blue-500/5 border-l-2 border-blue-500' : ''}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{data.nombre}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{data.proyectos.size} proyecto{data.proyectos.size !== 1 ? 's' : ''}</span>
                      <span className="text-blue-400 font-medium">{fmtH(data.horas)} fichadas</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-sm ${margen >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(margen)}</p>
                    <p className="text-gray-500 text-xs">margen</p>
                  </div>
                </div>
                {/* Mini bar */}
                {data.facturacion > 0 && (
                  <div className="mt-2 h-1 w-full rounded-full bg-gray-700 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(100, (data.coste / data.facturacion) * 100)}%` }} />
                  </div>
                )}
              </button>
            )
          })}
          {byEmp.length === 0 && <p className="text-gray-500 text-sm py-8 text-center">Sin datos</p>}
        </div>
      </div>

      {/* RIGHT: project breakdown */}
      <div className="lg:col-span-7 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {!selectedEmp ? (
          <div className="flex items-center justify-center h-full py-20 text-gray-600">
            <p className="text-sm">← Selecciona un empleado</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">{byEmp.find(([id]) => id === selectedEmp)?.[1].nombre}</h3>
              <p className="text-gray-500 text-xs mt-0.5">Desglose por proyecto{mes ? ` · ${MESES[mes-1]}` : ' · año completo'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                    {!mes && <th className="text-left px-4 py-3">Mes</th>}
                    <th className="text-left px-6 py-3">Proyecto / Cliente</th>
                    <th className="text-right px-4 py-3">Coste</th>
                    <th className="text-right px-4 py-3">Horas</th>
                    <th className="text-right px-4 py-3">€/h coste</th>
                    <th className="text-right px-4 py-3">Facturación</th>
                    <th className="text-right px-6 py-3">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {empRows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      {!mes && <td className="px-4 py-2.5 text-gray-500 text-xs">{MESES[r.mes-1]}</td>}
                      <td className="px-6 py-2.5">
                        <p className="text-white text-xs font-medium truncate max-w-[160px]">{r.clienteNombre}</p>
                        <p className="text-gray-600 text-[11px] truncate max-w-[160px]">{r.servicioNombre}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-orange-400 text-xs">{fmt(r.costeAsignado)}</td>
                      <td className="px-4 py-2.5 text-right text-blue-400 text-xs font-medium">{fmtH(r.horasFichadas)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{fmtEH(r.costeAsignado, r.horasFichadas)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300 text-xs">{r.facturacion > 0 ? fmt(r.facturacion) : '—'}</td>
                      <td className="px-6 py-2.5 text-right"><MargenBadge coste={r.costeAsignado} facturacion={r.facturacion} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-700 bg-gray-800/30">
                    {!mes && <td className="px-4 py-3" />}
                    <td className="px-6 py-3 text-gray-400 text-xs font-semibold uppercase">Total</td>
                    <td className="px-4 py-3 text-right text-orange-400 font-bold text-xs">
                      {fmt(empRows.reduce((s, r) => s + r.costeAsignado, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400 font-bold text-xs">
                      {fmtH(empRows.reduce((s, r) => s + r.horasFichadas, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">
                      {fmtEH(empRows.reduce((s, r) => s + r.costeAsignado, 0), empRows.reduce((s, r) => s + r.horasFichadas, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-bold text-xs">
                      {fmt(empRows.reduce((s, r) => s + r.facturacion, 0))}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <MargenBadge
                        coste={empRows.reduce((s, r) => s + r.costeAsignado, 0)}
                        facturacion={empRows.reduce((s, r) => s + r.facturacion, 0)}
                      />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── POR PROYECTO ─────────────────────────────────────────────────────────────
function TabPorProyecto({ rows, mes }: { rows: RendimientoRow[]; mes: number | null }) {
  const [selectedServicio, setSelectedServicio] = useState<string | null>(null)

  const filtered = useMemo(() =>
    mes ? rows.filter(r => r.mes === mes) : rows,
    [rows, mes]
  )

  const byServicio = useMemo(() => {
    const map = new Map<string, { nombre: string; cliente: string; dept: string; coste: number; horas: number; facturacion: number; empleados: Set<string> }>()
    for (const r of filtered) {
      if (!map.has(r.servicioId)) map.set(r.servicioId, { nombre: r.servicioNombre, cliente: r.clienteNombre, dept: r.deptNombre, coste: 0, horas: 0, facturacion: 0, empleados: new Set() })
      const e = map.get(r.servicioId)!
      e.coste += r.costeAsignado
      e.horas += r.horasFichadas
      e.facturacion += r.facturacion
      e.empleados.add(r.empId)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].facturacion - a[1].facturacion)
  }, [filtered])

  const servicioRows = useMemo(() =>
    filtered.filter(r => r.servicioId === selectedServicio).sort((a, b) => a.mes - b.mes || a.empNombre.localeCompare(b.empNombre)),
    [filtered, selectedServicio]
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT: project list */}
      <div className="lg:col-span-5 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Proyectos</h3>
          <p className="text-gray-500 text-xs mt-0.5">Selecciona uno para ver el equipo asignado</p>
        </div>
        <div className="divide-y divide-gray-800/50 max-h-[600px] overflow-y-auto">
          {byServicio.map(([svcId, data]) => {
            const margen = data.facturacion - data.coste
            const isSelected = selectedServicio === svcId
            return (
              <button key={svcId} onClick={() => setSelectedServicio(isSelected ? null : svcId)}
                className={`w-full text-left px-6 py-4 hover:bg-gray-800/30 transition-colors ${isSelected ? 'bg-blue-500/5 border-l-2 border-blue-500' : ''}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate text-sm">{data.cliente}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-gray-600 text-xs truncate">{data.nombre}</p>
                      <span className="text-[10px] bg-gray-800 border border-gray-700 text-gray-400 px-1.5 py-0.5 rounded shrink-0">{data.dept}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{data.empleados.size} persona{data.empleados.size !== 1 ? 's' : ''}</span>
                      <span className="text-blue-400 font-medium">{fmtH(data.horas)} fichadas</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-sm ${margen >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(margen)}</p>
                    <p className="text-gray-500 text-xs">margen</p>
                  </div>
                </div>
              </button>
            )
          })}
          {byServicio.length === 0 && <p className="text-gray-500 text-sm py-8 text-center">Sin datos</p>}
        </div>
      </div>

      {/* RIGHT: employee breakdown */}
      <div className="lg:col-span-7 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {!selectedServicio ? (
          <div className="flex items-center justify-center h-full py-20 text-gray-600">
            <p className="text-sm">← Selecciona un proyecto</p>
          </div>
        ) : (() => {
          const svc = byServicio.find(([id]) => id === selectedServicio)?.[1]
          return (
            <>
              <div className="px-6 py-4 border-b border-gray-800">
                <h3 className="text-white font-semibold">{svc?.cliente}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{svc?.nombre} · {svc?.dept}{mes ? ` · ${MESES[mes-1]}` : ' · año completo'}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                      {!mes && <th className="text-left px-4 py-3">Mes</th>}
                      <th className="text-left px-6 py-3">Empleado</th>
                      <th className="text-right px-4 py-3">Coste</th>
                      <th className="text-right px-4 py-3">Horas</th>
                      <th className="text-right px-4 py-3">€/h coste</th>
                      <th className="text-right px-4 py-3">Facturación</th>
                      <th className="text-right px-6 py-3">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicioRows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        {!mes && <td className="px-4 py-2.5 text-gray-500 text-xs">{MESES[r.mes-1]}</td>}
                        <td className="px-6 py-2.5 text-white text-xs font-medium">{r.empNombre}</td>
                        <td className="px-4 py-2.5 text-right text-orange-400 text-xs">{fmt(r.costeAsignado)}</td>
                        <td className="px-4 py-2.5 text-right text-blue-400 text-xs font-medium">{fmtH(r.horasFichadas)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{fmtEH(r.costeAsignado, r.horasFichadas)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300 text-xs">{r.facturacion > 0 ? fmt(r.facturacion) : '—'}</td>
                        <td className="px-6 py-2.5 text-right"><MargenBadge coste={r.costeAsignado} facturacion={r.facturacion} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-700 bg-gray-800/30">
                      {!mes && <td className="px-4 py-3" />}
                      <td className="px-6 py-3 text-gray-400 text-xs font-semibold uppercase">Total</td>
                      <td className="px-4 py-3 text-right text-orange-400 font-bold text-xs">
                        {fmt(servicioRows.reduce((s, r) => s + r.costeAsignado, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-400 font-bold text-xs">
                        {fmtH(servicioRows.reduce((s, r) => s + r.horasFichadas, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {fmtEH(servicioRows.reduce((s, r) => s + r.costeAsignado, 0), servicioRows.reduce((s, r) => s + r.horasFichadas, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-bold text-xs">
                        {fmt(servicioRows.reduce((s, r) => s + r.facturacion, 0))}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <MargenBadge
                          coste={servicioRows.reduce((s, r) => s + r.costeAsignado, 0)}
                          facturacion={servicioRows.reduce((s, r) => s + r.facturacion, 0)}
                        />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function RendimientoClient({ rows, anio, years }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'empleado' | 'proyecto'>('empleado')
  const [mes, setMes] = useState<number | null>(null)

  const totalCoste = rows.reduce((s, r) => s + r.costeAsignado, 0)
  const totalHoras = rows.reduce((s, r) => s + r.horasFichadas, 0)
  const totalFact = rows.reduce((s, r) => s + r.facturacion, 0)
  const totalMargen = totalFact - totalCoste

  const filteredRows = mes ? rows.filter(r => r.mes === mes) : rows

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Rendimiento por horas</h2>
          <p className="text-gray-400 text-sm mt-1">Cruce de coste asignado, horas fichadas y facturación</p>
        </div>
        {/* Year selector */}
        <div className="flex items-center gap-2">
          {years.map(y => (
            <button key={y} onClick={() => router.push(`/rendimiento?anio=${y}`)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${y === anio ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Coste total asignado', value: fmt(totalCoste), color: 'text-orange-400' },
          { label: 'Horas fichadas', value: totalHoras > 0 ? `${totalHoras.toFixed(1)}h` : '—', color: 'text-blue-400' },
          { label: 'Facturación', value: fmt(totalFact), color: 'text-green-400' },
          { label: 'Margen total', value: fmt(totalMargen), color: totalMargen >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs font-medium">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            <p className="text-gray-600 text-[10px] mt-0.5">Año {anio}{mes ? ` · ${MESES[mes-1]}` : ''}</p>
          </div>
        ))}
      </div>

      {/* Filters + tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Month pills */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setMes(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!mes ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            Año completo
          </button>
          {MESES.map((m, i) => {
            const hasDatos = rows.some(r => r.mes === i + 1)
            return (
              <button key={m} onClick={() => setMes(i + 1)} disabled={!hasDatos}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${mes === i + 1 ? 'bg-blue-600 text-white' : hasDatos ? 'bg-gray-800 text-gray-400 hover:text-white' : 'bg-gray-900 text-gray-700 cursor-not-allowed'}`}>
                {m}
              </button>
            )
          })}
        </div>

        {/* Tab toggle */}
        <div className="flex bg-gray-800 rounded-xl p-1">
          <button onClick={() => setTab('empleado')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === 'empleado' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            👤 Por empleado
          </button>
          <button onClick={() => setTab('proyecto')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === 'proyecto' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            💼 Por proyecto
          </button>
        </div>
      </div>

      {/* ⚠️ Warning if no time logs */}
      {rows.every(r => r.horasFichadas === 0) && (
        <div className="bg-yellow-950/30 border border-yellow-800/40 rounded-xl px-5 py-3 text-sm text-yellow-400 flex items-center gap-2">
          <span>⚠️</span>
          <span>Aún no hay horas fichadas en {anio}. Los datos de €/hora aparecerán cuando el equipo empiece a fichar en cada proyecto.</span>
        </div>
      )}

      {tab === 'empleado' && <TabPorEmpleado rows={filteredRows} mes={mes} />}
      {tab === 'proyecto' && <TabPorProyecto rows={filteredRows} mes={mes} />}
    </div>
  )
}
