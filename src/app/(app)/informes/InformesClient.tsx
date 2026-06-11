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
  servicio: { id: string; nombre: string | null; notas: string | null } | null
}
interface SueldoAgg { id_empleado: string; total: number }
interface DedicacionRow {
  id_empleado: string; id_departamento: string; porcentaje: number
  departamento: { id: string; nombre: string } | null
}

function fmtMin(m: number) {
  const h = Math.floor(m / 60), min = m % 60
  if (h > 0) return `${h}h ${min > 0 ? `${min}m` : ''}`.trim()
  return `${min}m`
}
function eur(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

const CLIENTES_CON_PROYECTOS = ['otros', 'way', 'ment/form', 'mentorías', 'mentorias']
const BAR_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500']
const BORDER_COLORS = ['border-blue-500', 'border-purple-500', 'border-green-500']

function clienteNecesitaProyecto(nombre: string) {
  return CLIENTES_CON_PROYECTOS.includes(nombre.toLowerCase())
}

type ViewMode = 'todo' | 'cliente' | 'departamento' | 'empleado'

export default function InformesClient() {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [desde, setDesde] = useState(firstOfMonth)
  const [hasta, setHasta] = useState(todayStr)
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [sueldos, setSueldos] = useState<SueldoAgg[]>([])
  const [dedicacion, setDedicacion] = useState<DedicacionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('todo')
  const [selectedId, setSelectedId] = useState<string>('')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [desde, hasta]) // eslint-disable-line

  async function fetchData() {
    setLoading(true)
    try {
      const hastaDate = new Date(hasta + 'T12:00:00')
      const hastaMes = hastaDate.getMonth() + 1
      const hastaAnio = hastaDate.getFullYear()

      const [logsRes, ingresosRes, sueldosRes, dedicacionRes] = await Promise.all([
        fetch(`/api/time-logs?desde=${desde}&hasta=${hasta}`),
        fetch(`/api/ingresos?desde=${desde}&hasta=${hasta}`),
        fetch(`/api/sueldos?desde=${desde}&hasta=${hasta}`),
        fetch(`/api/dedicacion?mes=${hastaMes}&anio=${hastaAnio}`),
      ])
      const logsData = await logsRes.json()
      const ingresosData = await ingresosRes.json()
      const sueldosData = await sueldosRes.json()
      const dedicacionData = await dedicacionRes.json()
      setLogs(Array.isArray(logsData) ? logsData : [])
      setIngresos(Array.isArray(ingresosData) ? ingresosData : [])
      setSueldos(Array.isArray(sueldosData) ? sueldosData : [])
      setDedicacion(Array.isArray(dedicacionData) ? dedicacionData : [])
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
    a.href = url; a.download = `fichajes_${desde}_${hasta}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const totalMin = logs.reduce((s, l) => s + l.minutos, 0)

  // ── Memos ─────────────────────────────────────────────────────────────────

  const sueldoMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sueldos) m.set(s.id_empleado, s.total)
    return m
  }, [sueldos])

  const dedicacionMap = useMemo(() => {
    const m = new Map<string, { id_departamento: string; nombre: string; porcentaje: number }[]>()
    for (const d of dedicacion) {
      if (!m.has(d.id_empleado)) m.set(d.id_empleado, [])
      m.get(d.id_empleado)!.push({
        id_departamento: d.id_departamento,
        nombre: d.departamento?.nombre ?? d.id_departamento,
        porcentaje: d.porcentaje,
      })
    }
    return m
  }, [dedicacion])

  const ingresosPorDepartamento = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of ingresos) {
      const did = i.id_departamento ?? '__sin__'
      m.set(did, (m.get(did) ?? 0) + Number(i.valor))
    }
    return m
  }, [ingresos])

  const byEmpleado = useMemo(() => {
    const map = new Map<string, {
      id: string; nombre: string; minutos: number
      clientes: Map<string, { minutos: number; proyectos: Set<string>; logs: TimeLog[] }>
      departamentos: Set<string>
    }>()
    for (const l of logs) {
      if (!map.has(l.id_empleado)) map.set(l.id_empleado, {
        id: l.id_empleado, nombre: l.empleado?.nombre ?? l.id_empleado,
        minutos: 0, clientes: new Map(), departamentos: new Set(),
      })
      const e = map.get(l.id_empleado)!
      e.minutos += l.minutos
      if (l.departamento?.id) e.departamentos.add(l.departamento.id)
      const cn = l.cliente?.nombre ?? 'Sin cliente'
      if (!e.clientes.has(cn)) e.clientes.set(cn, { minutos: 0, proyectos: new Set(), logs: [] })
      const c = e.clientes.get(cn)!
      c.minutos += l.minutos
      c.logs.push(l)
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
    const map = new Map<string, {
      id: string; nombre: string; minutos: number; ingresos: number
      empleados: Map<string, { minutos: number; empleadoId: string }>
      clientes: Map<string, number>
    }>()
    for (const l of logs) {
      const dn = l.departamento?.nombre ?? 'Sin departamento'
      const did = l.departamento?.id ?? '__sin__'
      if (!map.has(did)) map.set(did, {
        id: did, nombre: dn, minutos: 0,
        ingresos: ingresosPorDepartamento.get(did) ?? 0,
        empleados: new Map(), clientes: new Map(),
      })
      const d = map.get(did)!
      d.minutos += l.minutos
      const eid = l.id_empleado
      const en = l.empleado?.nombre ?? eid
      if (!d.empleados.has(eid)) d.empleados.set(eid, { minutos: 0, empleadoId: eid })
      d.empleados.get(eid)!.minutos += l.minutos
      // store nombre in empleados map by using eid as key but needing nombre separately:
      const cn = l.cliente?.nombre ?? 'Sin cliente'
      d.clientes.set(cn, (d.clientes.get(cn) ?? 0) + l.minutos)
      void en
    }
    // Update ingresos after building (in case dept had ingresos but no logs)
    for (const [did, val] of ingresosPorDepartamento.entries()) {
      if (!map.has(did)) continue
      map.get(did)!.ingresos = val
    }
    return Array.from(map.values()).sort((a, b) => b.minutos - a.minutos)
  }, [logs, ingresosPorDepartamento])

  // Employee name lookup from logs
  const empleadoNombres = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of logs) {
      if (l.empleado) m.set(l.id_empleado, l.empleado.nombre)
    }
    return m
  }, [logs])

  // ── Ingresos por cliente (total) ─────────────────────────────────────────
  const ingresosPorCliente = useMemo(() => {
    const map = new Map<string, number>()
    for (const i of ingresos) {
      if (!i.cliente?.id) continue
      map.set(i.cliente.id, (map.get(i.cliente.id) ?? 0) + Number(i.valor))
    }
    return map
  }, [ingresos])

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

  function rentabilidadPorDepto(clienteId: string) {
    const deptMap = new Map<string, { nombre: string; minutos: number; ingresos: number }>()
    for (const [key, { nombre, valor }] of ingresosPorClienteDepto.entries()) {
      const [cid, did] = key.split('__')
      if (cid !== clienteId) continue
      deptMap.set(did, { nombre, minutos: 0, ingresos: valor })
    }
    for (const l of logs) {
      if ((l.cliente?.id ?? '__sin__') !== clienteId) continue
      const did = l.departamento?.id ?? '__sin__'
      const dn = l.departamento?.nombre ?? 'Sin departamento'
      if (!deptMap.has(did)) deptMap.set(did, { nombre: dn, minutos: 0, ingresos: 0 })
      deptMap.get(did)!.minutos += l.minutos
    }
    return Array.from(deptMap.entries())
      .map(([id, d]) => ({
        id, nombre: d.nombre, dept: null as string | null,
        minutos: d.minutos, ingresos: d.ingresos,
        eurHora: d.ingresos > 0 && d.minutos >= 60 ? d.ingresos / (d.minutos / 60) : null,
      }))
      .sort((a, b) => b.ingresos - a.ingresos)
  }

  function rentabilidadPorServicio(clienteId: string) {
    const svcMap = new Map<string, { nombre: string; dept: string; minutos: number; ingresos: number }>()
    for (const i of ingresos) {
      if (i.cliente?.id !== clienteId || !i.servicio?.id) continue
      const key = i.servicio.id
      const nombre = i.servicio.notas ?? i.servicio.nombre ?? 'Sin nombre'
      const dept = i.departamento?.nombre ?? ''
      const existing = svcMap.get(key)
      if (existing) existing.ingresos += Number(i.valor)
      else svcMap.set(key, { nombre, dept, minutos: 0, ingresos: Number(i.valor) })
    }
    for (const l of logs) {
      if ((l.cliente?.id ?? '__sin__') !== clienteId) continue
      if (!l.servicio?.id) {
        const key = '__sin__'
        if (!svcMap.has(key)) svcMap.set(key, { nombre: 'Sin proyecto', dept: '', minutos: 0, ingresos: 0 })
        svcMap.get(key)!.minutos += l.minutos
        continue
      }
      const key = l.servicio.id
      if (!svcMap.has(key)) {
        svcMap.set(key, {
          nombre: l.servicio.notas ?? l.servicio.nombre ?? 'Sin nombre',
          dept: l.departamento?.nombre ?? '',
          minutos: 0, ingresos: 0,
        })
      }
      svcMap.get(key)!.minutos += l.minutos
    }
    return Array.from(svcMap.entries())
      .map(([id, d]) => ({
        id, nombre: d.nombre, dept: d.dept,
        minutos: d.minutos, ingresos: d.ingresos,
        eurHora: d.ingresos > 0 && d.minutos >= 60 ? d.ingresos / (d.minutos / 60) : null,
      }))
      .sort((a, b) => b.ingresos - a.ingresos)
  }

  // ── Vista detalle ─────────────────────────────────────────────────────────
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
  const eurPorHora = selectedIngresosTotal > 0 && selectedHoras >= 1 ? selectedIngresosTotal / selectedHoras : null

  const inputDateCls = 'bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-extrabold text-blue-400 uppercase tracking-widest">Siana Digital CRM</p>
          <h2 className="text-2xl font-black text-white mt-0.5">Informe de tiempos</h2>
          <p className="text-gray-400 text-sm mt-1">Fichajes del equipo por rango de fechas</p>
        </div>
        <button onClick={exportCSV} disabled={logs.length === 0}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
          ↓ Exportar CSV
        </button>
      </div>

      {/* Selector de rango */}
      <div className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-wrap">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Periodo:</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Desde</span>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={inputDateCls} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Hasta</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={inputDateCls} />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm py-16 text-center">Cargando...</p>
      ) : logs.length === 0 ? (
        <div className="py-16 border border-dashed border-gray-700 rounded-2xl text-center text-gray-500">
          <p className="font-bold text-gray-400">Sin registros en el periodo seleccionado</p>
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
                <button key={v} onClick={() => { setViewMode(v); setSelectedId(''); setExpandedKey(null) }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${viewMode === v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  {['🗂 Todo','🏢 Por cliente','🗄 Por departamento','👤 Por empleado'][i]}
                </button>
              ))}
            </div>
            {viewMode === 'cliente' && (
              <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setExpandedKey(null) }}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 min-w-[220px]">
                <option value="">— Selecciona cliente —</option>
                {byCliente.map(c => <option key={c.id} value={c.id}>{c.nombre} ({fmtMin(c.minutos)})</option>)}
              </select>
            )}
            {viewMode === 'departamento' && (
              <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setExpandedKey(null) }}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 min-w-[220px]">
                <option value="">— Selecciona departamento —</option>
                {byDepartamento.map(d => <option key={d.id} value={d.id}>{d.nombre} ({fmtMin(d.minutos)})</option>)}
              </select>
            )}
            {viewMode === 'empleado' && (
              <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setExpandedKey(null) }}
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
                eurHora: ingresosPorCliente.get(c.id) && c.minutos >= 60
                  ? ingresosPorCliente.get(c.id)! / (c.minutos/60) : undefined,
              }))} showRenta />

              <ResumenTable title="Por departamento" rows={byDepartamento.map(d => ({
                nombre: d.nombre,
                minutos: d.minutos,
                detalle: Array.from(d.clientes.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n])=>n).join(', '),
                pct: totalMin > 0 ? (d.minutos/totalMin)*100 : 0,
              }))} />
            </div>
          )}

          {/* ── VISTA CLIENTE ── */}
          {viewMode === 'cliente' && selectedClienteData && (() => {
            const esMultiProyecto = clienteNecesitaProyecto(selectedClienteData.nombre)
            const rentRows = esMultiProyecto
              ? rentabilidadPorServicio(selectedClienteData.id)
              : rentabilidadPorDepto(selectedClienteData.id)
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KPIBox label="Total horas" value={fmtMin(selectedClienteData.minutos)} />
                  <KPIBox label="Personas" value={String(selectedClienteData.empleados.size)} />
                  <KPIBox label="Ingresos periodo" value={selectedIngresosTotal > 0 ? eur(selectedIngresosTotal) : '—'} color="text-green-400" />
                  <KPIBox label="€/hora global" value={eurPorHora ? `${eurPorHora.toFixed(0)}€/h` : '—'}
                    color={eurPorHora ? (eurPorHora >= 50 ? 'text-green-400' : eurPorHora >= 25 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-400'} />
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-800">
                    <h3 className="text-white font-bold">
                      {esMultiProyecto ? 'Rentabilidad por proyecto' : 'Rentabilidad por departamento / servicio'}
                    </h3>
                    <p className="text-gray-500 text-xs mt-0.5">Cruce real: ingresos del servicio ÷ horas dedicadas</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                      {esMultiProyecto && <th className="text-left px-6 py-3">Departamento</th>}
                      <th className="text-left px-6 py-3">{esMultiProyecto ? 'Proyecto' : 'Departamento'}</th>
                      <th className="text-right px-4 py-3">Horas</th>
                      <th className="text-right px-4 py-3">Ingresos</th>
                      <th className="text-right px-6 py-3">€/hora real</th>
                    </tr></thead>
                    <tbody>
                      {rentRows.map(d => (
                        <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          {esMultiProyecto && (
                            <td className="px-6 py-3 text-xs text-gray-500">{d.dept || '—'}</td>
                          )}
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

                <DetalleTable logs={filteredLogs} showProyecto showDept />
              </div>
            )
          })()}

          {/* ── VISTA DEPARTAMENTO ── */}
          {viewMode === 'departamento' && selectedDeptData && (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <KPIBox label="Total ingresos" value={selectedDeptData.ingresos > 0 ? eur(selectedDeptData.ingresos) : '—'} color="text-green-400" />
                <KPIBox label="Total horas" value={fmtMin(selectedDeptData.minutos)} />
                <KPIBox label="Personas" value={String(selectedDeptData.empleados.size)} />
                {(() => {
                  const eh = selectedDeptData.ingresos > 0 && selectedDeptData.minutos >= 60
                    ? selectedDeptData.ingresos / (selectedDeptData.minutos / 60) : null
                  return (
                    <KPIBox label="€/hora" value={eh ? `${eh.toFixed(0)}€/h` : '—'}
                      color={eh ? (eh >= 50 ? 'text-green-400' : eh >= 25 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-400'} />
                  )
                })()}
                <KPIBox label="Clientes" value={String(selectedDeptData.clientes.size)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Por empleado — collapsible */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h4 className="text-sm font-bold text-white mb-3">Por empleado</h4>
                  <div className="space-y-1">
                    {Array.from(selectedDeptData.empleados.entries())
                      .sort((a, b) => b[1].minutos - a[1].minutos)
                      .map(([eid, empData], idx) => {
                        const nombre = empleadoNombres.get(eid) ?? eid
                        const pct = selectedDeptData.minutos > 0 ? (empData.minutos / selectedDeptData.minutos) * 100 : 0
                        const key = `${selectedId}_${eid}`
                        const isExpanded = expandedKey === key
                        const empLogs = filteredLogs.filter(l => l.id_empleado === eid)
                        return (
                          <div key={eid}>
                            <button
                              onClick={() => setExpandedKey(isExpanded ? null : key)}
                              className={`w-full flex items-center justify-between text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                                isExpanded ? 'bg-gray-800/40' : 'hover:bg-gray-800/20'
                              } border-l-2 ${BORDER_COLORS[idx % BORDER_COLORS.length]}`}
                            >
                              <span className="text-gray-300">{nombre}</span>
                              <span className="flex items-center gap-2">
                                <span className="font-mono text-white">{fmtMin(empData.minutos)}</span>
                                <span className="text-gray-500">({pct.toFixed(0)}%)</span>
                                <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
                              </span>
                            </button>
                            <div className="px-3 mb-1">
                              <div className="h-1.5 w-full rounded-full bg-gray-700 mt-1">
                                <div className={`h-full rounded-full ${BAR_COLORS[idx % BAR_COLORS.length]}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="mt-1 mb-2 bg-gray-900/60 rounded-lg overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-500 border-b border-gray-800">
                                      <th className="text-left px-3 py-1.5">Fecha</th>
                                      <th className="text-left px-3 py-1.5">Cliente</th>
                                      <th className="text-left px-3 py-1.5">Descripción</th>
                                      <th className="text-right px-3 py-1.5">Tiempo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {empLogs.map(l => (
                                      <tr key={l.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                                        <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">
                                          {new Date(l.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                        </td>
                                        <td className="px-3 py-1.5 text-gray-300">{l.cliente?.nombre ?? '—'}</td>
                                        <td className="px-3 py-1.5 text-gray-400 max-w-[140px] truncate" title={l.descripcion}>{l.descripcion}</td>
                                        <td className="px-3 py-1.5 text-right font-mono text-blue-400 font-bold">{fmtMin(l.minutos)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* Por cliente — with project badges */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h4 className="text-sm font-bold text-white mb-3">Por cliente</h4>
                  <div className="space-y-2">
                    {Array.from(selectedDeptData.clientes.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([cn, mins], idx) => {
                        const pct = selectedDeptData.minutos > 0 ? (mins / selectedDeptData.minutos) * 100 : 0
                        // Find project badges for this client
                        const proyectos = clienteNecesitaProyecto(cn)
                          ? (() => {
                              const ps = new Map<string, number>()
                              for (const l of filteredLogs) {
                                if ((l.cliente?.nombre ?? 'Sin cliente') === cn && l.servicio) {
                                  const p = l.servicio.notas ?? l.servicio.nombre ?? l.servicio.id
                                  ps.set(p, (ps.get(p) ?? 0) + l.minutos)
                                }
                              }
                              return Array.from(ps.entries()).sort((a,b) => b[1]-a[1])
                            })()
                          : []
                        return (
                          <div key={cn}>
                            <div className="flex items-center justify-between text-xs font-semibold mb-1">
                              <span className="flex items-center gap-1.5 text-gray-300 flex-wrap">
                                {cn}
                                {proyectos.map(([p]) => (
                                  <span key={p} className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{p}</span>
                                ))}
                              </span>
                              <span className="font-mono text-white shrink-0 ml-2">{fmtMin(mins)}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-gray-700">
                              <div className={`h-full rounded-full ${BAR_COLORS[idx % BAR_COLORS.length]}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>

              <DetalleTable logs={filteredLogs} showProyecto />
            </div>
          )}

          {/* ── VISTA EMPLEADO ── */}
          {viewMode === 'empleado' && selectedEmpData && (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <KPIBox label="Total horas" value={fmtMin(selectedEmpData.minutos)} />
                <KPIBox label="Clientes" value={String(selectedEmpData.clientes.size)} />
                {(() => {
                  const sueldo = sueldoMap.get(selectedEmpData.id)
                  return <KPIBox label="Sueldo periodo" value={sueldo != null ? eur(sueldo) : '—'} color="text-orange-400" />
                })()}
                {(() => {
                  const sueldo = sueldoMap.get(selectedEmpData.id) ?? 0
                  const horas = selectedEmpData.minutos / 60
                  const eh = sueldo > 0 && horas >= 1 ? sueldo / horas : null
                  return (
                    <KPIBox label="€/hora" value={eh ? `${eh.toFixed(0)}€/h` : '—'}
                      color={eh ? (eh <= 25 ? 'text-green-400' : eh <= 50 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-400'} />
                  )
                })()}
                <KPIBox label="Dptos activos" value={String(selectedEmpData.departamentos.size)} />
              </div>

              {/* Departamentos activos panel */}
              {(() => {
                const depts = Array.from(selectedEmpData.departamentos)
                const dedicRows = dedicacionMap.get(selectedEmpData.id) ?? []
                if (depts.length === 0 && dedicRows.length === 0) return null
                // Collect all dept ids
                const allDepts = new Map<string, string>()
                for (const l of filteredLogs) {
                  if (l.id_empleado === selectedEmpData.id && l.departamento) {
                    allDepts.set(l.departamento.id, l.departamento.nombre)
                  }
                }
                return (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-white mb-3">Departamentos activos</h4>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(allDepts.entries()).map(([did, dn]) => {
                        const ded = dedicRows.find(d => d.id_departamento === did)
                        return (
                          <span key={did} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
                            ded ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                          }`}>
                            {ded ? '✓' : '⚠️'} {dn}
                            {ded && <span className="text-gray-400">({ded.porcentaje}%)</span>}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Desglose por cliente — collapsible */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h4 className="text-sm font-bold text-white mb-3">Desglose por cliente</h4>
                <div className="space-y-1">
                  {Array.from(selectedEmpData.clientes.entries()).sort((a,b)=>b[1].minutos-a[1].minutos).map(([cn, data]) => {
                    const key = `emp_${selectedEmpData.id}_${cn}`
                    const isExpanded = expandedKey === key
                    return (
                      <div key={cn}>
                        <button
                          onClick={() => setExpandedKey(isExpanded ? null : key)}
                          className={`w-full flex items-center justify-between text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                            isExpanded ? 'bg-gray-800/40' : 'hover:bg-gray-800/20'
                          }`}
                        >
                          <span className="flex items-center gap-2 text-gray-300">
                            {cn}
                            {data.proyectos.size > 0 && Array.from(data.proyectos).map(p => (
                              <span key={p} className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{p}</span>
                            ))}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-white">{fmtMin(data.minutos)}</span>
                            <span className="text-gray-500">({selectedEmpData.minutos > 0 ? ((data.minutos/selectedEmpData.minutos)*100).toFixed(0) : 0}%)</span>
                            <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="mt-1 mb-2 bg-gray-900/60 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 border-b border-gray-800">
                                  <th className="text-left px-3 py-1.5">Fecha</th>
                                  <th className="text-left px-3 py-1.5">Descripción</th>
                                  <th className="text-left px-3 py-1.5">Departamento</th>
                                  <th className="text-right px-3 py-1.5">Tiempo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.logs.map(l => (
                                  <tr key={l.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                                    <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">
                                      {new Date(l.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                    </td>
                                    <td className="px-3 py-1.5 text-gray-300 max-w-[160px] truncate" title={l.descripcion}>{l.descripcion}</td>
                                    <td className="px-3 py-1.5 text-purple-400">{l.departamento?.nombre ?? '—'}</td>
                                    <td className="px-3 py-1.5 text-right font-mono text-blue-400 font-bold">{fmtMin(l.minutos)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="px-3 mb-1">
                          <div className="h-1.5 w-full rounded-full bg-gray-700">
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${selectedEmpData.minutos > 0 ? (data.minutos/selectedEmpData.minutos)*100 : 0}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
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
