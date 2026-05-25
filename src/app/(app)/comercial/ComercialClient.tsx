'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

interface Empleado { id: string; nombre: string }

interface Captacion {
  id: string
  id_captador: string | null
  id_mantenedor: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  captador: { id: string; nombre: string } | null
  mantenedor: { id: string; nombre: string } | null
  cliente: { id: string; nombre: string; activo: boolean } | null
}

interface ResumenRow {
  id: string
  nombre: string
  revenue: number
  clientes: number
}

interface Props {
  captaciones: Captacion[]
  empleados: Empleado[]
  resumenCaptador: ResumenRow[]
  resumenMantenedor: ResumenRow[]
  anio: number
}

interface CaptacionForm {
  id_captador: string
  id_mantenedor: string
  fecha_inicio: string
  fecha_fin: string
}

export default function ComercialClient({ captaciones, empleados, resumenCaptador, resumenMantenedor, anio }: Props) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<CaptacionForm>({ id_captador: '', id_mantenedor: '', fecha_inicio: '', fecha_fin: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const openEdit = (c: Captacion) => {
    setEditId(c.id)
    setForm({
      id_captador: c.id_captador ?? '',
      id_mantenedor: c.id_mantenedor ?? '',
      fecha_inicio: c.fecha_inicio ?? '',
      fecha_fin: c.fecha_fin ?? '',
    })
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/captacion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId,
          id_captador: form.id_captador || null,
          id_mantenedor: form.id_mantenedor || null,
          fecha_inicio: form.fecha_inicio || null,
          fecha_fin: form.fecha_fin || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      setShowModal(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  const filtered = captaciones.filter(c =>
    (c.cliente?.nombre ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const topCaptador = resumenCaptador[0]
  const topMantenedor = resumenMantenedor[0]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Comercial</h2>
          <p className="text-gray-400 text-sm mt-1">Captación y mantenimiento de clientes</p>
        </div>
        <div className="flex items-center gap-2">
          {years.map(y => (
            <button key={y} onClick={() => router.push(`/comercial?anio=${y}`)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${y === anio ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm mb-3">Top captador {anio}</p>
          {topCaptador ? (
            <>
              <p className="text-white text-lg font-bold">{topCaptador.nombre}</p>
              <p className="text-green-400 text-xl font-bold mt-1">{fmt(topCaptador.revenue)}</p>
              <p className="text-gray-500 text-xs mt-1">{topCaptador.clientes} clientes</p>
            </>
          ) : (
            <p className="text-gray-500 text-sm">Sin datos</p>
          )}
          {resumenCaptador.length > 1 && (
            <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
              {resumenCaptador.slice(1, 4).map(r => (
                <div key={r.id} className="flex justify-between text-sm">
                  <span className="text-gray-400">{r.nombre}</span>
                  <span className="text-gray-300">{fmt(r.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm mb-3">Top mantenedor {anio}</p>
          {topMantenedor ? (
            <>
              <p className="text-white text-lg font-bold">{topMantenedor.nombre}</p>
              <p className="text-blue-400 text-xl font-bold mt-1">{fmt(topMantenedor.revenue)}</p>
              <p className="text-gray-500 text-xs mt-1">{topMantenedor.clientes} clientes</p>
            </>
          ) : (
            <p className="text-gray-500 text-sm">Sin datos</p>
          )}
          {resumenMantenedor.length > 1 && (
            <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
              {resumenMantenedor.slice(1, 4).map(r => (
                <div key={r.id} className="flex justify-between text-sm">
                  <span className="text-gray-400">{r.nombre}</span>
                  <span className="text-gray-300">{fmt(r.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Asignaciones table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Asignaciones de clientes</h3>
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 w-48"
          />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-6 py-3">Cliente</th>
              <th className="text-left px-6 py-3">Captador</th>
              <th className="text-left px-6 py-3">Mantenedor</th>
              <th className="text-left px-6 py-3">Fecha inicio</th>
              <th className="text-left px-6 py-3">Estado</th>
              <th className="text-center px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-500 py-12">Sin asignaciones</td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-6 py-3">
                  <span className="text-white font-medium">{c.cliente?.nombre ?? '—'}</span>
                  {c.cliente && !c.cliente.activo && (
                    <span className="block text-gray-500 text-xs">cliente inactivo</span>
                  )}
                </td>
                <td className="px-6 py-3 text-gray-300">{c.captador?.nombre ?? <span className="text-gray-600">—</span>}</td>
                <td className="px-6 py-3 text-gray-300">{c.mantenedor?.nombre ?? <span className="text-gray-600">—</span>}</td>
                <td className="px-6 py-3 text-gray-400 text-sm">{c.fecha_inicio ?? '—'}</td>
                <td className="px-6 py-3">
                  {c.fecha_fin ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-900/40 text-red-400">
                      Perdido ({c.fecha_fin})
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-900/40 text-green-400">
                      Activo
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-center">
                  <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700 transition-colors">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Edit captacion */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">Editar asignación</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {error && <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm">{error}</div>}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Captador</label>
                  <select value={form.id_captador} onChange={e => setForm(f => ({ ...f, id_captador: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sin captador</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Mantenedor</label>
                  <select value={form.id_mantenedor} onChange={e => setForm(f => ({ ...f, id_mantenedor: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sin mantenedor</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Fecha inicio</label>
                    <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Fecha fin (si perdido)</label>
                    <input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
