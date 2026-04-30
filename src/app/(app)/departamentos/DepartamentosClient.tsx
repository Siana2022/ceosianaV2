'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Departamento = { id: string; nombre: string; activo: boolean }

export default function DepartamentosClient({
  departamentos,
}: {
  departamentos: Departamento[]
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Departamento | null>(null)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    setEditing(null)
    setNombre('')
    setShowModal(true)
  }

  const openEdit = (d: Departamento) => {
    setEditing(d)
    setNombre(d.nombre)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    if (editing) {
      await fetch('/api/departamentos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, nombre: nombre.trim() }),
      })
    } else {
      await fetch('/api/departamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim() }),
      })
    }
    setSaving(false)
    setShowModal(false)
    router.refresh()
  }

  const handleToggle = async (d: Departamento) => {
    await fetch('/api/departamentos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: d.id, activo: !d.activo }),
    })
    router.refresh()
  }

  const handleDelete = async (d: Departamento) => {
    if (!window.confirm(`¿Eliminar el departamento "${d.nombre}"? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/departamentos?id=${d.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Departamentos</h2>
          <p className="text-gray-400 text-sm mt-1">{departamentos.length} departamentos</p>
        </div>
        <button
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + Nuevo departamento
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-6 py-3">Nombre</th>
              <th className="text-left px-6 py-3">Estado</th>
              <th className="text-right px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {departamentos.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                  No hay departamentos. Crea el primero.
                </td>
              </tr>
            )}
            {departamentos.map(d => (
              <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-6 py-4 text-white font-medium">{d.nombre}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      d.activo
                        ? 'bg-green-900/50 text-green-400 border border-green-800'
                        : 'bg-red-900/50 text-red-400 border border-red-800'
                    }`}
                  >
                    {d.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => openEdit(d)}
                    className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 py-1.5 text-xs transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggle(d)}
                    className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 py-1.5 text-xs transition-colors"
                  >
                    {d.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => handleDelete(d)}
                    className="bg-red-900/50 hover:bg-red-800 text-red-400 hover:text-white rounded-lg px-3 py-1.5 text-xs transition-colors"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">
                {editing ? 'Editar departamento' : 'Nuevo departamento'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Nombre *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="Nombre del departamento"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !nombre.trim()}
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
