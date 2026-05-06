'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

const today = () => new Date().toISOString().split('T')[0]

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface Cliente {
  id: string
  nombre: string
  activo: boolean
  fecha_alta: string | null
  notas: string | null
  mrr: number
  num_servicios: number
  captador_nombre: string
  mantenedor_nombre: string
  ingresos_total: number
  gastos_directos: number
  coste_personal: number
  resultado: number
  margen_pct: number
}

interface Props {
  clientes: Cliente[]
  year: number
  years: number[]
  month: number // 0 = todos los meses
}

type ModalMode = 'create' | 'edit'

interface FormState {
  nombre: string
  fecha_alta: string
  notas: string
}

export default function ClientesClient({ clientes, year, years, month }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [mode, setMode] = useState<ModalMode>('create')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ nombre: '', fecha_alta: today(), notas: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  const askConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirmModal({ title, message, onConfirm })

  const openCreate = () => {
    setMode('create')
    setEditId(null)
    setForm({ nombre: '', fecha_alta: today(), notas: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (c: Cliente, e: React.MouseEvent) => {
    e.stopPropagation()
    setMode('edit')
    setEditId(c.id)
    setForm({ nombre: c.nombre, fecha_alta: c.fecha_alta ?? today(), notas: c.notas ?? '' })
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError('')
    try {
      const method = mode === 'create' ? 'POST' : 'PUT'
      const body = mode === 'create'
        ? { nombre: form.nombre.trim(), fecha_alta: form.fecha_alta, notas: form.notas }
        : { id: editId, nombre: form.nombre.trim(), fecha_alta: form.fecha_alta, notas: form.notas }

      const res = await fetch('/api/clientes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Error al guardar')
        return
      }
      setShowModal(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (c: Cliente, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch('/api/clientes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, nombre: c.nombre, activo: !c.activo }),
    })
    router.refresh()
  }

  const deleteCliente = (c: Cliente, e: React.MouseEvent) => {
    e.stopPropagation()
    askConfirm(
      'Eliminar cliente',
      `¿Eliminar a "${c.nombre}"? Se eliminarán todos sus servicios, ingresos y gastos asociados. Esta acción no se puede deshacer.`,
      async () => {
        setConfirmModal(null)
        await fetch(`/api/clientes?id=${c.id}`, { method: 'DELETE' })
        router.refresh()
      }
    )
  }

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title ?? ''}
        message={confirmModal?.message ?? ''}
        onConfirm={confirmModal?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmModal(null)}
      />
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Clientes</h2>
          <p className="text-gray-400 text-sm mt-1">{clientes.length} clientes · {clientes.filter(c => c.activo).length} activos</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Year selector */}
          <div className="flex items-center gap-1">
            {years.map(y => (
              <a
                key={y}
                href={`/clientes?year=${y}${month > 0 ? `&month=${month}` : ''}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  y === year ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                {y}
              </a>
            ))}
          </div>
          {/* Month selector */}
          <div className="flex items-center gap-1 flex-wrap">
            <a
              href={`/clientes?year=${year}`}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                month === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              Todos
            </a>
            {MESES_CORTO.map((m, i) => (
              <a
                key={i}
                href={`/clientes?year=${year}&month=${i + 1}`}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  month === i + 1 ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                {m}
              </a>
            ))}
          </div>
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 w-56"
          />
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Nuevo cliente
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-right px-4 py-3">Fact. mensual</th>
                <th className="text-right px-4 py-3">
                  {month > 0 ? `Ingresos ${MESES_CORTO[month - 1]} ${year}` : `Ingresos ${year}`}
                </th>
                <th className="text-right px-4 py-3">Costes Dir.</th>
                <th className="text-right px-4 py-3">Coste Personal</th>
                <th className="text-right px-4 py-3">Resultado</th>
                <th className="text-right px-4 py-3">Margen %</th>
                <th className="text-center px-4 py-3">Estado</th>
                <th className="text-center px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-gray-500 py-12">No hay clientes</td>
                </tr>
              )}
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/clientes/${c.id}`)}
                  className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-white font-medium">{c.nombre}</span>
                    {c.fecha_alta && (
                      <span className="block text-gray-500 text-xs mt-0.5">Alta: {c.fecha_alta}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={c.mrr > 0 ? 'text-green-400 font-semibold' : 'text-gray-500'}>
                      {fmt(c.mrr)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-white">
                    {c.ingresos_total > 0 ? fmt(c.ingresos_total) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-400">
                    {c.gastos_directos > 0 ? fmt(c.gastos_directos) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-400">
                    {c.coste_personal > 0 ? fmt(c.coste_personal) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.ingresos_total > 0 ? (
                      <span className={`font-semibold ${c.resultado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(c.resultado)}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.ingresos_total > 0 ? (
                      <span className={`font-semibold ${c.margen_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {c.margen_pct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      c.activo ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => openEdit(c, e)}
                        className="text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700 text-xs"
                      >
                        Editar
                      </button>
                      <button
                        onClick={e => toggleActivo(c, e)}
                        className="text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700 text-xs"
                      >
                        {c.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={e => deleteCliente(c, e)}
                        className="text-red-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-gray-700 text-xs"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">{mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm">{error}</div>
                )}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Nombre del cliente"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Fecha de alta</label>
                  <input
                    type="date"
                    value={form.fecha_alta}
                    onChange={e => setForm(f => ({ ...f, fecha_alta: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Notas</label>
                  <textarea
                    value={form.notas}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="Notas opcionales..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? 'Guardando...' : mode === 'create' ? 'Crear cliente' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
