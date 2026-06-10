'use client'

import { useState, useEffect, useMemo } from 'react'

interface TimeLog {
  id: string; id_empleado: string; descripcion: string; fecha: string
  minutos: number
  empleado: { id: string; nombre: string } | null
  cliente: { id: string; nombre: string } | null
  departamento: { id: string; nombre: string } | null
  servicio: { id: string; nombre: string | null; notas: string | null } | null
}
interface Ingreso {
  id: string; valor: number; mes: number; anio: number; concepto?: string
  id_departamento?: string | null
  cliente: { id: string; nombre: string } | null
  departamento: { id: string; nombre: string } | null
  servicio: { id: string; nombre: string | null } | null
}

function fmtMin(m: number) {
  const h = Math.floor(m / 60), min = m % 60
  if (h > 0) return `${h}h ${min > 0 ? `${min}m` : ''}`.trim()
  return `${min}m`
}
function eur(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const CLIENTES_CON_PROYECTOS = ['otros', 'way', 'ment/form', 'mentorías', 'mentorias']

function clienteNecesitaProyecto(nombre: string) {
  return CLIENTES_CON_PROYECTOS.includes(nombre.toLowerCase())
}

type ViewMode = 'todo' | 'cliente' | 'departamento' | 'empleado'

export default function InformesClient() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('todo')
  const [selectedId, setSelectedId] = useState<string>('')

  useEffect(() => { fetchData() }, [mes, anio]) // eslint-disable-line

  async function fetchData() {
    setLoading(true)
    try {
      const mesStr = `${anio}-${String(mes).padStart(2,'0')}`
      const [logsRes, ingresosRes] = await Promise.all([
        fetch(`/api/time-logs?fecha=${mesStr}`),
        fetch(`/api/ingresos?mes=${mes}&anio=${anio}`),
      ])
      const logsData = await logsRes.json()
      const ingresosData = await ingresosRes.json()
      setLogs(Array.isArray(logsData) ? logsData : [])
      setIngresos(Array.isArray(ingresosData) ? ingresosData : [])
    } finally { setLoading(false) }
  }

  function exportCSV() {
    const rows = [
      ['Fecha','Empleado','Descripción','Cliente','Proyecto','Departamento','Minutos','Horas'],
      ...logs.map(l => {
        const proyecto = l.servicio ? (l.servicio.notas ?? l.servicio.nombre ?? '') : ''
        return [
          l.fecha,
          l.empleado?.nombre ?? '',
          `"${l.descripcion.replace(/"/g,'""')}"`,
          l.cliente?.nombre ?? '',
          `"${proyecto}"`,
          l.departamento?.nombre ?? '',
          String(l.minutos),
          (l.minutos / 60).toFixed(2),
        ]
      })
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `fichajes_${anio}_${String(mes).padStart(2,'0')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const totalMin = logs.reduce((s, l) => s + l.minutos, 0)

  // ── Agrupaciones ──────────────────────────────────────────────────────────

  const byEmpleado = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string; minutos: number; clientes: Map<string, { minutos: number; proyectos: Set<string> }> }>()
    for (const l of logs) {
      if (!map.has(l.id_empleado)) map.set(l.id_empleado, { id: l.id_empleado, nombre: l.empleado?.nombre ?? l.id_empleado, minutos: 0, clientes: new Map() })
      const e = map.get(l.id_empleado)!
      e.minutos += l.minutos
      const cn = l.cliente?.nombre ?? 'Sin cliente'
      if (!e.clientes.has(cn)) e.clientes.set(cn, { minutos: 0, proyectos: new Set() })
      const c = e.clientes.get(cn)!
      c.minutos += l.minutos
      if (l.servicio) c.proyectos.add(l.servicio.notas ?? l.servicio.nombre ?? l.servicio.id)
    }
    return Array.from(map.values()).sort((a, b) => b.minutos - a.minutos)
  }, [logs])

  const byCliente = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string; minutos: number; empleados: Map<string, number>; proyectos: Map<string, number>; sinProyecto: number }>()
    for (const l of logs) {
      const cn = l.cliente?.nombre ?? 'Sin cliente'
      const cid = l.cliente?.id ?? '__sin__'
      if (!map.has(cid)) map.set(cid, { id: cid, nombre: cn, minutos: 0, empleados: new Map(), proyectos: new Map(), sinProyecto: 0 })
      const c = map.get(cid)!
      c.minutos += l.minutos
      const en = l.empleado?.nombre ?? l.id_empleado
      c.empleados.set(en, (c.empleados.get(en) ?? 0) + l.minutos)
      if (clienteNecesitaProyecto(cn)) {
        if (l.servicio) {
          const pn = l.servicio.notas ?? l.servicio.nombre ?? l.servicio.id
          c.proyectos.set(pn, (c.proyectos.get(pn) ?? 0) + l.minutos)
        } else { c.sinProyecto += l.minutos }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.minutos - a.minutos)
  }, [logs])

  const byDepartamento = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string; minutos: number; empleados: Map<string, number>; proyectos: Map<string, number> }>()
    for (const l of logs) {
      const dn = l.departamento?.nombre ?? 'Sin departamento'
      const did = l.departamento?.id ?? '__sin__'
      if (!map.has(did)) map.set(did, { id: did, nombre: dn, minutos: 0, empleados: new Map(), proyectos: new Map() })
      const d = map.get(did)!
      d.minutos += l.minutos
      const en = l.empleado?.nombre ?? l.id_empleado
      d.empleados.set(en, (d.empleados.get(en) ?? 0) + l.minutos)
      const cn = l.cliente?.nombre ?? 'Sin cliente'
      d.proyectos.set(cn, (d.proyectos.get(cn) ?? 0) + l.minutos)
    }
    return Array.from(map.values()).sort((a, b) => b.minutos - a.minutos)
  }, [logs])

  // ── Ingresos por cliente (total) ───────────────────────────────────────
  const ingresosPorCliente = useMemo(() => {
    const map = new Map<string, number>()
    for (const i of ingresos) {
      if (!i.cliente?.id) continue
      map.set(i.cliente.id, (map.get(i.cliente.id) ?? 0) + Number(i.valor))
    }
    return map
  }, [ingresos])

  // ── Ingresos por cliente+departamento ──────────────────────────────────
  // key: `${clienteId}__${deptoId}`
  const ingresosPorClienteDepto = useMemo(() => {
    const map = new Map<string, { nombre: string; valor: number }>()
    for (const i of ingresos) {
      if (!i.cliente?.id) continue
      const deptId = i.id_departamento ?? '__sin__'
      const deptNombre = i.departamento?.nombre ?? 'Sin departamento'
      const key = `${i.cliente.id}__${deptId}`
      const existing = map.get(key)
      if (existing) existing.valor += Number(i.valor)
      else map.set(key, { nombre: deptNombre, valor: Number(i.valor) })
    }
    return map
  }, [ingresos])

  // ── Horas + ingresos por departamento dentro de un cliente ────────────
  function rentabilidadPorDepto(clienteId: string) {
    const deptMap = new Map<string, { nombre: string; minutos: number; ingresos: number }>()

    // Primero seed con todos los departamentos que tienen ingresos para este cliente
    for (const [key, { nombre, valor }] of ingresosPorClienteDepto.entries()) {
      const [cid, did] = key.split('__')
      if (cid !== clienteId) continue
      deptMap.set(did, { nombre, minutos: 0, ingresos: valor })
    }

    // Luego acumular horas de time_logs
    for (const l of logs) {
      if ((l.cliente?.id ?? '__sin__') !== clienteId) continue
      const did = l.departamento?.id ?? '__sin__'
      const dn = l.departamento?.nombre ?? 'Sin departamento'
      if (!deptMap.has(did)) {
        deptMap.set(did, { nombre: dn, minutos: 0, ingresos: 0 })
      }
      deptMap.get(did)!.minutos += l.minutos
    }

    return Array.from(deptMap.entries())
      .map(([id, d]) => ({
        id,
        nombre: d.nombre,
        minutos: d.minutos,
        ingresos: d.ingresos,
        eurHora: d.ingresos > 0 && d.minutos > 0 ? d.ingresos / (d.minutos / 60) : null,
      }))
      .sort((a, b) => b.ingresos - a.ingresos)
  }

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 1 + i)

  // ── Vista detalle ───────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    if (viewMode === 'cliente' && selectedId) return logs.filter(l => (l.cliente?.id ?? '__sin__') === selectedId)
    if (viewMode === 'departamento' && selectedId) return logs.filter(l => (l.departamento?.id ?? '__sin__') === selectedId)
    if (viewMode === 'empleado' && selectedId) return logs.filter(l => l.id_empleado === selectedId)
    return logs
  }, [logs, viewMode, selectedId])

  const selectedClienteData = viewMode === 'cliente' && selectedId ? byCliente.find(c => c.id === selectedId) : null
  const selectedDeptData = viewMode === 'departamento' && selectedId ? byDepartamento.find(d => d.id === selectedId) : null
  const selectedEmpData = viewMode === 'empleado' && selectedId ? byEmpleado.find(e => e.id === selectedId) : null
  const selectedIngresosTotal = selectedClienteData ? (ingresosPorCliente.get(selectedId) ?? 0) : 0
  const selectedHoras = filteredLogs.reduce((s, l) => s + l.minutos, 0) / 60
  const eurPorHora = selectedIngresosTotal > 0 && selectedHoras > 0 ? selectedIngresosTotal / selectedHoras : null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-extrabold text-blue-400 uppercase tracking-widest">Siana Digital CRM</p>
          <h2 className="text-2xl font-black text-white mt-0.5">Informe mensual de tiempos</h2>
          <p className="text-gray-400 text-sm mt-1">Fichajes del equipo por mes</p>
        </div>
        <button onClick={exportCSV} disabled={logs.length === 0}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
          ↓ Exportar CSV
        </button>
      </div>

      {/* Selector mes/año */}
      <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-wrap">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Periodo:</span>
        <div className="flex flex-wrap gap-1.5">
          {MESES.map((nombre, i) => (
            <button key={i} onClick={() => setMes(i + 1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mes === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {nombre.slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 ml-2">
          {years.map(y => (
            <button key={y} onClick={() => setAnio(y)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${anio === y ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm py-16 text-center">Cargando...</p>
      ) : logs.length === 0 ? (
        <div className="py-16 border border-dashed border-gray-700 rounded-2xl text-center text-gray-500">
          <p className="font-bold text-gray-400">Sin registros en {MESES[mes-1]} {anio}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total horas', value: fmtMin(totalMin), icon: '⏱️' },
              { label: 'Empleados activos', value: String(byEmpleado.length), icon: '👥' },
              { label: 'Clientes', value: String(byCliente.filter(c => c.nombre !== 'Sin cliente').length), icon: '🏢' },
              { label: 'Registros', value: String(logs.length), icon: '📋' },
            ].map(k => (
              <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{k.icon} {k.label}</div>
                <p className="font-mono text-2xl font-black text-white">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Vista / Filtros */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['todo','cliente','departamento','empleado'] as ViewMode[]).map((v, i) => (
                <button key={v} onClick={() => { setViewMode(v); setSelectedId('') }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${viewMode === v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  {['🗂 Todo','🏢 Por cliente','🗄 Por departamento','👤 Por empleado'][i]}
                </button>
              ))}
            </div>
            {viewMode === 'cliente' && (
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 min-w-[220px]">
                <option value="">— Selecciona cliente —</option>
                {byCliente.map(c => <option key={c.id} value={c.id}>{c.nombre} ({fmtMin(c.minutos)})</option>)}
              </select>
            )}
            {viewMode === 'departamento' && (
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 min-w-[220px]">
                <option value="">— Selecciona departamento —</option>
                {byDepartamento.map(d => <option key={d.id} value={d.id}>{d.nombre} ({fmtMin(d.minutos)})</option>)}
              </select>
            )}
            {viewMode === 'empleado' && (
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 min-w-[220px]">
                <option value="">— Selecciona empleado —</option>
                {byEmpleado.map(e => <option key={e.id} value={e.id}>{e.nombre} ({fmtMin(e.minutos)})</option>)}
              </select>
            )}
          </div>

          {/* ── VISTA TODO ── */}
          {viewMode === 'todo' && (
            <div className="space-y-5">
              <ResumenTable title="Por empleado" rows={byEmpleado.map(e => ({
                nombre: e.nombre,
                minutos: e.minutos,
                detalle: Array.from(e.clientes.entries()).sort((a,b)=>b[1].minutos-a[1].minutos).slice(0,3).map(([n])=>n).join(', '),
                pct: totalMin > 0 ? (e.minutos/totalMin)*100 : 0,
              }))} />

              <ResumenTable title="Por cliente" rows={byCliente.map(c => ({
                nombre: c.nombre,
                minutos: c.minutos,
                detalle: Array.from(c.empleados.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n])=>n).join(', '),
                pct: totalMin > 0 ? (c.minutos/totalMin)*100 : 0,
                extra: ingresosPorCliente.get(c.id) ? eur(ingresosPorCliente.get(c.id)!) : undefined,
                eurHora: ingresosPorCliente.get(c.id) && c.minutos > 0
                  ? ingresosPorCliente.get(c.id)! / (c.minutos/60) : undefined,
              }))} showRenta />

              <ResumenTable title="Por departamento" rows={byDepartamento.map(d => ({
                nombre: d.nombre,
                minutos: d.minutos,
                detalle: Array.from(d.proyectos.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n])=>n).join(', '),
                pct: totalMin > 0 ? (d.minutos/totalMin)*100 : 0,
              }))} />
            </div>
          )}

          {/* ── VISTA CLIENTE ── */}
          {viewMode === 'cliente' && selectedClienteData && (() => {
            const rentDepto = rentabilidadPorDepto(selectedClienteData.id)
            return (
              <div className="space-y-4">
                {/* KPIs globales del cliente */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KPIBox label="Total horas" value={fmtMin(selectedClienteData.minutos)} />
                  <KPIBox label="Personas" value={String(selectedClienteData.empleados.size)} />
                  <KPIBox label="Ingresos mes" value={selectedIngresosTotal > 0 ? eur(selectedIngresosTotal) : '—'} color="text-green-400" />
                  <KPIBox label="€/hora global" value={eurPorHora ? `${eurPorHora.toFixed(0)}€/h` : '—'}
                    color={eurPorHora ? (eurPorHora >= 50 ? 'text-green-400' : eurPorHora >= 25 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-400'} />
                </div>

                {/* Rentabilidad por departamento */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-800">
                    <h3 className="text-white font-bold">Rentabilidad por departamento / servicio</h3>
                    <p className="text-gray-500 text-xs mt-0.5">Cruce real: ingresos del servicio ÷ horas dedicadas = coste hora real</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                      <th className="text-left px-6 py-3">Departamento</th>
                      <th className="text-right px-4 py-3">Horas</th>
                      <th className="text-right px-4 py-3">Ingresos</th>
                      <th className="text-right px-6 py-3">€/hora real</th>
                    </tr></thead>
                    <tbody>
                      {rentDepto.map(d => (
                        <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="px-6 py-3 font-medium text-white">{d.nombre}</td>
                          <td className="px-4 py-3 text-right font-mono text-blue-400 font-bold">{fmtMin(d.minutos)}</td>
                          <td className="px-4 py-3 text-right text-green-400 font-mono text-sm">
                            {d.ingresos > 0 ? eur(d.ingresos) : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {d.eurHora != null ? (
                              <span className={`text-sm font-bold font-mono px-3 py-1 rounded-full ${
                                d.eurHora >= 50 ? 'bg-green-500/15 text-green-400' :
                                d.eurHora >= 25 ? 'bg-yellow-500/15 text-yellow-400' :
                                'bg-red-500/15 text-red-400'
                              }`}>{d.eurHora.toFixed(0)}€/h</span>
                            ) : d.minutos > 0 ? (
                              <span className="text-xs text-gray-500">Sin ingreso asignado</span>
                            ) : (
                              <span className="text-xs text-gray-500">Sin horas</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Proyectos internos WAY/Otros/Ment */}
                {clienteNecesitaProyecto(selectedClienteData.nombre) && selectedClienteData.proyectos.size > 0 && (
                  <ProyectosBox proyectos={selectedClienteData.proyectos} sinProyecto={selectedClienteData.sinProyecto} />
                )}

                {/* Detalle completo */}
                <DetalleTable logs={filteredLogs} showProyecto showDept />
              </div>
            )
          })()}

          {/* ── VISTA DEPARTAMENTO ── */}
          {viewMode === 'departamento' && selectedDeptData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KPIBox label="Total horas" value={fmtMin(selectedDeptData.minutos)} />
                <KPIBox label="Personas" value={String(selectedDeptData.empleados.size)} />
                <KPIBox label="Clientes" value={String(selectedDeptData.proyectos.size)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MiniTable title="Por empleado" items={Array.from(selectedDeptData.empleados.entries()).sort((a,b)=>b[1]-a[1])} total={selectedDeptData.minutos} />
                <MiniTable title="Por cliente" items={Array.from(selectedDeptData.proyectos.entries()).sort((a,b)=>b[1]-a[1])} total={selectedDeptData.minutos} />
              </div>
              <DetalleTable logs={filteredLogs} showProyecto />
            </div>
          )}

          {/* ── VISTA EMPLEADO ── */}
          {viewMode === 'empleado' && selectedEmpData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KPIBox label="Total horas" value={fmtMin(selectedEmpData.minutos)} />
                <KPIBox label="Clientes" value={String(selectedEmpData.clientes.size)} />
                <KPIBox label="Registros" value={String(filteredLogs.length)} />
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h4 className="text-sm font-bold text-white mb-3">Desglose por cliente</h4>
                <div className="space-y-3">
                  {Array.from(selectedEmpData.clientes.entries()).sort((a,b)=>b[1].minutos-a[1].minutos).map(([cn, data]) => (
                    <div key={cn}>
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="text-gray-300">{cn}</span>
                        <span className="font-mono text-white">{fmtMin(data.minutos)}
                          <span className="text-gray-500 ml-1">({selectedEmpData.minutos > 0 ? ((data.minutos/selectedEmpData.minutos)*100).toFixed(0) : 0}%)</span>
                        </span>
                      </div>
                      {data.proyectos.size > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {Array.from(data.proyectos).map(p => (
                            <span key={p} className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{p}</span>
                          ))}
                        </div>
                      )}
                      <div className="h-1.5 w-full rounded-full bg-gray-700">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${selectedEmpData.minutos > 0 ? (data.minutos/selectedEmpData.minutos)*100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DetalleTable logs={filteredLogs} showProyecto />
            </div>
          )}

          {/* Selección pendiente en filtros */}
          {viewMode !== 'todo' && !selectedId && (
            <div className="py-10 text-center text-gray-500 text-sm">Selecciona un elemento del desplegable para ver el detalle</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function KPIBox({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`font-mono text-2xl font-black ${color}`}>{value}</p>
    </div>
  )
}

function ResumenTable({ title, rows, showRenta }: {
  title: string
  rows: { nombre: string; minutos: number; detalle: string; pct: number; extra?: string; eurHora?: number }[]
  showRenta?: boolean
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h3 className="text-white font-bold">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
          <th className="text-left px-6 py-3">Nombre</th>
          <th className="text-left px-4 py-3">Horas</th>
          <th className="text-left px-4 py-3">Detalle</th>
          {showRenta && <th className="text-right px-4 py-3">Ingresos</th>}
          {showRenta && <th className="text-right px-4 py-3">€/hora</th>}
          <th className="text-right px-6 py-3">%</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.nombre} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="px-6 py-3 font-medium text-white">{r.nombre}</td>
              <td className="px-4 py-3 font-mono text-blue-400 font-bold">{fmtMin(r.minutos)}</td>
              <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">{r.detalle}</td>
              {showRenta && <td className="px-4 py-3 text-right text-green-400 text-xs font-mono">{r.extra ?? '—'}</td>}
              {showRenta && (
                <td className="px-4 py-3 text-right">
                  {r.eurHora != null ? (
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                      r.eurHora >= 50 ? 'bg-green-500/15 text-green-400' :
                      r.eurHora >= 25 ? 'bg-yellow-500/15 text-yellow-400' :
                      'bg-red-500/15 text-red-400'
                    }`}>{r.eurHora.toFixed(0)}€/h</span>
                  ) : <span className="text-gray-600 text-xs">—</span>}
                </td>
              )}
              <td className="px-6 py-3 text-right text-gray-500 text-xs font-mono">{r.pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProyectosBox({ proyectos, sinProyecto }: { proyectos: Map<string, number>; sinProyecto: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h4 className="text-sm font-bold text-white mb-3">Proyectos internos</h4>
      <div className="flex flex-wrap gap-2">
        {Array.from(proyectos.entries()).sort((a,b)=>b[1]-a[1]).map(([nombre, mins]) => (
          <span key={nombre} className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs px-3 py-1.5 rounded-full font-medium">
            {nombre} <span className="text-blue-500 font-mono">{fmtMin(mins)}</span>
          </span>
        ))}
        {sinProyecto > 0 && (
          <span className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs px-3 py-1.5 rounded-full font-medium">
            ⚠️ Sin proyecto asignado <span className="text-yellow-500 font-mono">{fmtMin(sinProyecto)}</span>
          </span>
        )}
      </div>
    </div>
  )
}

function MiniTable({ title, items, total }: { title: string; items: [string, number][]; total: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h4 className="text-sm font-bold text-white mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map(([nombre, mins]) => {
          const pct = total > 0 ? (mins/total)*100 : 0
          return (
            <div key={nombre}>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-300 truncate">{nombre}</span>
                <span className="font-mono text-white shrink-0 ml-2">{fmtMin(mins)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-700">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DetalleTable({ logs, showProyecto, showDept }: { logs: TimeLog[]; showProyecto?: boolean; showDept?: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-white font-bold">Detalle completo</h3>
        <span className="text-xs text-gray-500">{logs.length} registros</span>
      </div>
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-5 py-2.5">Fecha</th>
              <th className="text-left px-4 py-2.5">Empleado</th>
              <th className="text-left px-4 py-2.5">Descripción</th>
              <th className="text-left px-4 py-2.5">Cliente</th>
              {showDept && <th className="text-left px-4 py-2.5">Departamento</th>}
              {showProyecto && <th className="text-left px-4 py-2.5">Proyecto</th>}
              <th className="text-right px-5 py-2.5">Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => {
              const needsProyecto = l.cliente?.nombre ? clienteNecesitaProyecto(l.cliente.nombre) : false
              const proyecto = l.servicio ? (l.servicio.notas ?? l.servicio.nombre) : null
              return (
                <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-2 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(l.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'short' })}
                  </td>
                  <td className="px-4 py-2 text-white text-sm">{l.empleado?.nombre ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-300 max-w-[160px] truncate" title={l.descripcion}>{l.descripcion}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{l.cliente?.nombre ?? '—'}</td>
                  {showDept && (
                    <td className="px-4 py-2 text-xs text-purple-400">{l.departamento?.nombre ?? <span className="text-gray-600">—</span>}</td>
                  )}
                  {showProyecto && (
                    <td className="px-4 py-2 text-xs">
                      {needsProyecto ? (
                        proyecto
                          ? <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{proyecto}</span>
                          : <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">⚠️ No seleccionado</span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                  )}
                  <td className="px-5 py-2 text-right font-mono text-blue-400 font-bold">{fmtMin(l.minutos)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
