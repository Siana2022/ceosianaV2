'use client'

import { useState, useEffect, useMemo } from 'react'

interface TimeLog {
  id: string; id_empleado: string; descripcion: string; fecha: string
  minutos: number
  empleado: { id: string; nombre: string } | null
  cliente: { id: string; nombre: string } | null
  departamento: { id: string; nombre: string } | null
  servicio: { id: string; nombre: string | null } | null
}

function fmtMin(m: number) {
  const h = Math.floor(m / 60), min = m % 60
  if (h > 0) return `${h}h ${min > 0 ? `${min}m` : ''}`.trim()
  return `${min}m`
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function InformesClient() {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(false)
  const [debug, setDebug] = useState<string>('')

  useEffect(() => { fetchLogs() }, [mes, anio]) // eslint-disable-line

  async function fetchLogs() {
    setLoading(true)
    setDebug('')
    try {
      const mesStr = `${anio}-${String(mes).padStart(2,'0')}`
      const res = await fetch(`/api/time-logs?fecha=${mesStr}`)
      const text = await res.text()
      setDebug(`Status: ${res.status} | Body: ${text.slice(0, 300)}`)
      try {
        const data = JSON.parse(text)
        setLogs(Array.isArray(data) ? data : [])
      } catch { setLogs([]) }
    } finally { setLoading(false) }
  }

  const byEmpleado = useMemo(() => {
    const map = new Map<string, { nombre: string; minutos: number; clientes: Map<string, number> }>()
    for (const l of logs) {
      if (!map.has(l.id_empleado)) map.set(l.id_empleado, { nombre: l.empleado?.nombre ?? l.id_empleado, minutos: 0, clientes: new Map() })
      const e = map.get(l.id_empleado)!
      e.minutos += l.minutos
      const cn = l.cliente?.nombre ?? 'Sin cliente'
      e.clientes.set(cn, (e.clientes.get(cn) ?? 0) + l.minutos)
    }
    return Array.from(map.values()).sort((a, b) => b.minutos - a.minutos)
  }, [logs])

  const byCliente = useMemo(() => {
    const map = new Map<string, { minutos: number; empleados: Map<string, number> }>()
    for (const l of logs) {
      const cn = l.cliente?.nombre ?? 'Sin cliente'
      if (!map.has(cn)) map.set(cn, { minutos: 0, empleados: new Map() })
      const c = map.get(cn)!
      c.minutos += l.minutos
      const en = l.empleado?.nombre ?? l.id_empleado
      c.empleados.set(en, (c.empleados.get(en) ?? 0) + l.minutos)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].minutos - a[1].minutos)
  }, [logs])

  const totalMin = logs.reduce((s, l) => s + l.minutos, 0)

  function exportCSV() {
    const rows = [
      ['Fecha','Empleado','Descripción','Cliente','Departamento','Minutos','Horas'],
      ...logs.map(l => [
        l.fecha,
        l.empleado?.nombre ?? '',
        `"${l.descripcion.replace(/"/g,'""')}"`,
        l.cliente?.nombre ?? '',
        l.departamento?.nombre ?? '',
        String(l.minutos),
        (l.minutos / 60).toFixed(2),
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fichajes_${anio}_${String(mes).padStart(2,'0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 1 + i)

  return (
    <div className="p-6 space-y-6">
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

      {/* Selector */}
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

      {debug && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 font-mono text-xs text-yellow-300 break-all">
          {debug}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm py-16 text-center">Cargando...</p>
      ) : logs.length === 0 ? (
        <div className="py-16 border border-dashed border-gray-700 rounded-2xl text-center text-gray-500">
          <p className="font-bold text-gray-400">Sin registros en {MESES[mes-1]} {anio}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total horas', value: fmtMin(totalMin), icon: '⏱️' },
              { label: 'Empleados activos', value: String(byEmpleado.length), icon: '👥' },
              { label: 'Registros', value: String(logs.length), icon: '📋' },
            ].map(k => (
              <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{k.icon} {k.label}</div>
                <p className="font-mono text-2xl font-black text-white">{k.value}</p>
              </div>
            ))}
          </div>

          {/* By employee */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-bold">Por empleado</h3>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-6 py-3">Empleado</th>
                <th className="text-left px-4 py-3">Horas</th>
                <th className="text-left px-4 py-3">Clientes</th>
                <th className="text-right px-6 py-3">%</th>
              </tr></thead>
              <tbody>
                {byEmpleado.map(e => (
                  <tr key={e.nombre} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-3 font-medium text-white">{e.nombre}</td>
                    <td className="px-4 py-3 font-mono text-blue-400 font-bold">{fmtMin(e.minutos)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {Array.from(e.clientes.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n])=>n).join(', ')}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-500 text-xs font-mono">
                      {totalMin > 0 ? ((e.minutos / totalMin) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By client */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-bold">Por cliente</h3>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-6 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Horas</th>
                <th className="text-left px-4 py-3">Equipo</th>
                <th className="text-right px-6 py-3">%</th>
              </tr></thead>
              <tbody>
                {byCliente.map(([nombre, data]) => (
                  <tr key={nombre} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-3 font-medium text-white">{nombre}</td>
                    <td className="px-4 py-3 font-mono text-blue-400 font-bold">{fmtMin(data.minutos)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {Array.from(data.empleados.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n])=>n).join(', ')}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-500 text-xs font-mono">
                      {totalMin > 0 ? ((data.minutos / totalMin) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Full detail */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-white font-bold">Detalle completo</h3>
              <span className="text-xs text-gray-500">{logs.length} registros</span>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-900">
                  <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                    <th className="text-left px-6 py-2.5">Fecha</th>
                    <th className="text-left px-4 py-2.5">Empleado</th>
                    <th className="text-left px-4 py-2.5">Descripción</th>
                    <th className="text-left px-4 py-2.5">Cliente</th>
                    <th className="text-right px-6 py-2.5">Tiempo</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-6 py-2 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(l.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-2 text-white text-sm">{l.empleado?.nombre ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-300 max-w-[220px] truncate" title={l.descripcion}>{l.descripcion}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{l.cliente?.nombre ?? '—'}</td>
                      <td className="px-6 py-2 text-right font-mono text-blue-400 text-sm font-bold">{fmtMin(l.minutos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
