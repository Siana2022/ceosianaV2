'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Empleado = {
  id: string
  nombre: string
  email: string | null
  activo: boolean
  fecha_alta: string | null
  fecha_baja: string | null
  sueldo_actual: number | null
  total_anual: number
}

type ModalState = { mode: 'new' } | { mode: 'edit'; empleado: Empleado }

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export default function EquipoClient({ empleados }: { empleados: Empleado[] }) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState | null>(null)
  const [form, setForm] = useState({ nombre: '', email: '', fecha_alta: '', fecha_baja: '' })
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    setForm({ nombre: '', email: '', fecha_alta: new Date().toISOString().slice(0, 10), fecha_baja: '' })
    setModal({ mode: 'new' })
  }

  const openEdit = (e: Empleado) => {
    setForm({
      nombre: e.nombre,
      email: e.email ?? '',
      fecha_alta: e.fecha_alta ?? '',
      fecha_baja: e.fecha_baja ?? '',
    })
    setModal({ mode: 'edit', empleado: e })
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    if (modal?.mode === 'edit') {
      await fetch('/api/empleados', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modal.empleado.id,
          nombre: form.nombre.trim(),
          email: form.email.trim() || null,
          fecha_alta: form.fecha_alta || null,
          fecha_baja: form.fecha_baja || null,
          activo: !form.fecha_baja,
        }),
      })
    } else {
      await fetch('/api/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          email: form.email.trim() || null,
          fecha_alta: form.fecha_alta || null,
        }),
      })
    }
    setSaving(false)
    setModal(null)
    router.refresh()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Equipo</h2>
          <p className="text-gray-400 text-sm mt-1">
            {empleados.filter(e => e.activo).length} activos · {empleados.length} total
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + Nuevo empleado
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-6 py-3">Nombre</th>
              <th className="text-left px-6 py-3">Email</th>
              <th className="text-right px-6 py-3">Sueldo actual</th>
              <th className="text-right px-6 py-3">Total anual</th>
              <th className="text-left px-6 py-3">Estado</th>
              <th className="text-left px-6 py-3">Fecha alta</th>
              <th className="text-right px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empleados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No hay empleados. Añade el primero.
                </td>
              </tr>
            )}
            {empleados.map(e => (
              <tr
                key={e.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                onClick={() => router.push(`/equipo/${e.id}`)}
              >
                <td className="px-6 py-4 text-white font-medium">{e.nombre}</td>
                <td className="px-6 py-4 text-gray-400">{e.email ?? '—'}</td>
                <td className="px-6 py-4 text-right text-white">
                  {e.sueldo_actual != null ? fmt(e.sueldo_actual) : '—'}
                </td>
                <td className="px-6 py-4 text-right text-gray-300">
                  {e.total_anual > 0 ? fmt(e.total_anual) : '—'}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      e.activo
                        ? 'bg-green-900/50 text-green-400 border border-green-800'
                        : 'bg-red-900/50 text-red-400 border border-red-800'
                    }`}
                  >
                    {e.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-400">{fmtDate(e.fecha_alta)}</td>
                <td className="px-6 py-4 text-right" onClick={ev => ev.stopPropagation()}>
                  <button
                    onClick={() => openEdit(e)}
                    className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 py-1.5 text-xs transition-colors"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">
                {modal.mode === 'new' ? 'Nuevo empleado' : 'Editar empleado'}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-white text-xl">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre completo"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@empresa.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Fecha de alta</label>
                <input
                  type="date"
                  value={form.fecha_alta}
                  onChange={e => setForm(f => ({ ...f, fecha_alta: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              {modal.mode === 'edit' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Fecha de baja{' '}
                    <span className="text-gray-600">(deja vacío si sigue activo)</span>
                  </label>
                  <input
                    type="date"
                    value={form.fecha_baja}
                    onChange={e => setForm(f => ({ ...f, fecha_baja: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setModal(null)}
                  className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.nombre.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
