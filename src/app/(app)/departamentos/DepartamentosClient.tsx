'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Empleado = { id: string; nombre: string }
type Departamento = { id: string; nombre: string; activo: boolean; miembros: Empleado[] }

export default function DepartamentosClient({
  departamentos,
  empleados,
}: {
  departamentos: Departamento[]
  empleados: Empleado[]
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Departamento | null>(null)
  const [nombre, setNombre] = useState('')
  const [selectedEmpleados, setSelectedEmpleados] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    setEditing(null)
    setNombre('')
    setSelectedEmpleados([])
    setShowModal(true)
  }

  const openEdit = (d: Departamento) => {
    setEditing(d)
    setNombre(d.nombre)
    setSelectedEmpleados(d.miembros.map(m => m.id))
    setShowModal(true)
  }

  const toggleEmpleado = (id: string) => {
    setSelectedEmpleados(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    if (editing) {
      await fetch('/api/departamentos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, nombre: nombre.trim(), empleado_ids: selectedEmpleados }),
      })
    } else {
      await fetch('/api/departamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), empleado_ids: selectedEmpleados }),
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

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {departamentos.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-600">
            <p className="text-3xl mb-3">🗂️</p>
            <p className="text-gray-500">No hay departamentos. Crea el primero.</p>
          </div>
        )}
        {departamentos.map(d => (
          <div
            key={d.id}
            className={`bg-gray-900 border rounded-xl p-5 space-y-4 ${
              d.activo ? 'border-gray-800' : 'border-gray-800 opacity-60'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-white font-semibold text-base">{d.nombre}</h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                    d.activo
                      ? 'bg-green-900/50 text-green-400 border border-green-800'
                      : 'bg-red-900/50 text-red-400 border border-red-800'
                  }`}
                >
                  {d.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <span className="text-gray-500 text-xs bg-gray-800 px-2 py-1 rounded-lg flex-shrink-0">
                {d.miembros.length} {d.miembros.length === 1 ? 'persona' : 'personas'}
              </span>
            </div>

            {/* Members */}
            {d.miembros.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {d.miembros.map(m => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 bg-blue-900/30 border border-blue-800/40 text-blue-300 text-xs px-2 py-1 rounded-full"
                  >
                    <span className="w-4 h-4 rounded-full bg-blue-600/50 text-[10px] flex items-center justify-center font-bold text-blue-200">
                      {m.nombre.charAt(0).toUpperCase()}
                    </span>
                    {m.nombre.split(' ')[0]}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-xs italic">Sin miembros asignados</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1 border-t border-gray-800">
              <button
                onClick={() => openEdit(d)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => handleToggle(d)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg px-3 py-1.5 text-xs transition-colors"
              >
                {d.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button
                onClick={() => handleDelete(d)}
                className="bg-red-900/30 hover:bg-red-800/50 text-red-400 hover:text-red-300 rounded-lg px-3 py-1.5 text-xs transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
              <h3 className="text-white font-semibold">
                {editing ? 'Editar departamento' : 'Nuevo departamento'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Nombre */}
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

              {/* Miembros */}
              <div>
                <label className="block text-sm text-gray-400 mb-3">
                  Miembros del departamento
                  <span className="ml-2 text-gray-600 font-normal">
                    ({selectedEmpleados.length} seleccionados)
                  </span>
                </label>
                {empleados.length === 0 ? (
                  <p className="text-gray-600 text-sm">No hay empleados activos. Añade empleados primero.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {empleados.map(emp => {
                      const checked = selectedEmpleados.includes(emp.id)
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => toggleEmpleado(emp.id)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                            checked
                              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
                              checked
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'border-gray-600 text-transparent'
                            }`}
                          >
                            ✓
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
                              {emp.nombre.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-sm truncate">{emp.nombre}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-800 flex-shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !nombre.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
