'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

type Empleado = { id: string; nombre: string }
type Miembro = { id: string; nombre: string; porcentaje: number }
type Departamento = { id: string; nombre: string; activo: boolean; miembros: Miembro[] }

interface DeptRentabilidad {
  id: string
  nombre: string
  ingresos: number
  costePersonal: number
  gastosPropios: number
  costTotal: number
  resultado: number
  margenPct: number
}

export default function DepartamentosClient({
  departamentos,
  empleados,
  rentabilidad,
  anio,
}: {
  departamentos: Departamento[]
  empleados: Empleado[]
  rentabilidad: DeptRentabilidad[]
  anio: number
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Departamento | null>(null)
  const [nombre, setNombre] = useState('')
  // Selected employees: {id, porcentaje}
  const [selectedEmpleados, setSelectedEmpleados] = useState<{ id: string; porcentaje: number }[]>([])
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
    setSelectedEmpleados(d.miembros.map(m => ({ id: m.id, porcentaje: m.porcentaje || 100 })))
    setShowModal(true)
  }

  const isSelected = (id: string) => selectedEmpleados.some(e => e.id === id)

  const toggleEmpleado = (id: string) => {
    setSelectedEmpleados(prev =>
      prev.some(e => e.id === id)
        ? prev.filter(e => e.id !== id)
        : [...prev, { id, porcentaje: 100 }]
    )
  }

  const setPorcentaje = (id: string, porcentaje: number) => {
    setSelectedEmpleados(prev =>
      prev.map(e => e.id === id ? { ...e, porcentaje } : e)
    )
  }

  const totalPorcentaje = (empId: string) => {
    // How much of this employee is already assigned across selected
    return selectedEmpleados.find(e => e.id === empId)?.porcentaje ?? 0
  }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    const body = {
      nombre: nombre.trim(),
      empleados: selectedEmpleados.map(e => ({ id_empleado: e.id, porcentaje: e.porcentaje })),
    }
    if (editing) {
      await fetch('/api/departamentos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...body }),
      })
    } else {
      await fetch('/api/departamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const deptWithData = rentabilidad.filter(r => r.ingresos > 0 || r.costTotal > 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Departamentos</h2>
          <p className="text-gray-400 text-sm mt-1">{departamentos.length} departamentos · la dedicación se guarda para todo el año en curso</p>
        </div>
        <button
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + Nuevo departamento
        </button>
      </div>

      {/* Rentabilidad por departamento */}
      {rentabilidad.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Rentabilidad por departamento — {anio}</h3>
            <p className="text-gray-500 text-xs mt-0.5">Ingresos, costes de personal y gastos propios del año</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                  <th className="text-left px-4 py-3">Departamento</th>
                  <th className="text-right px-4 py-3">Ingresos</th>
                  <th className="text-right px-4 py-3">Coste Personal</th>
                  <th className="text-right px-4 py-3">Gastos Propios</th>
                  <th className="text-right px-4 py-3">Resultado</th>
                  <th className="text-right px-4 py-3">Margen %</th>
                </tr>
              </thead>
              <tbody>
                {(deptWithData.length > 0 ? deptWithData : rentabilidad).map(r => (
                  <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-white font-medium">{r.nombre}</td>
                    <td className="px-4 py-3 text-right text-white">{fmt(r.ingresos)}</td>
                    <td className="px-4 py-3 text-right text-orange-400">{fmt(r.costePersonal)}</td>
                    <td className="px-4 py-3 text-right text-orange-400">{fmt(r.gastosPropios)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.resultado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(r.resultado)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.margenPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {r.ingresos > 0 ? `${r.margenPct.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {rentabilidad.length > 1 && (() => {
                const totIngresos = rentabilidad.reduce((s, r) => s + r.ingresos, 0)
                const totPersonal = rentabilidad.reduce((s, r) => s + r.costePersonal, 0)
                const totGastos = rentabilidad.reduce((s, r) => s + r.gastosPropios, 0)
                const totResultado = rentabilidad.reduce((s, r) => s + r.resultado, 0)
                const totMargen = totIngresos > 0 ? (totResultado / totIngresos) * 100 : 0
                return (
                  <tfoot>
                    <tr className="border-t-2 border-gray-700 bg-gray-800/50">
                      <td className="px-4 py-3 text-white font-bold">Total</td>
                      <td className="px-4 py-3 text-right text-white font-bold">{fmt(totIngresos)}</td>
                      <td className="px-4 py-3 text-right text-orange-400 font-bold">{fmt(totPersonal)}</td>
                      <td className="px-4 py-3 text-right text-orange-400 font-bold">{fmt(totGastos)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${totResultado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(totResultado)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${totMargen >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totIngresos > 0 ? `${totMargen.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                )
              })()}
            </table>
          </div>
        </div>
      )}

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

            {/* Members with dedication */}
            {d.miembros.length > 0 ? (
              <div className="space-y-1.5">
                {d.miembros.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-blue-600/50 text-[10px] flex items-center justify-center font-bold text-blue-200 flex-shrink-0">
                        {m.nombre.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-blue-300 text-xs truncate">{m.nombre.split(' ')[0]}</span>
                    </div>
                    {m.porcentaje > 0 && (
                      <span className={`text-xs font-mono flex-shrink-0 ${m.porcentaje === 100 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {m.porcentaje}%
                      </span>
                    )}
                  </div>
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
              <div>
                <h3 className="text-white font-semibold">
                  {editing ? 'Editar departamento' : 'Nuevo departamento'}
                </h3>
                <p className="text-gray-500 text-xs mt-0.5">La dedicación se aplicará a todos los meses del año en curso</p>
              </div>
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
                  placeholder="Nombre del departamento"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              {/* Miembros con dedicación */}
              <div>
                <label className="block text-sm text-gray-400 mb-3">
                  Equipo y dedicación
                  <span className="ml-2 text-gray-600 font-normal">
                    ({selectedEmpleados.length} seleccionados)
                  </span>
                </label>
                {empleados.length === 0 ? (
                  <p className="text-gray-600 text-sm">No hay empleados activos. Añade empleados primero.</p>
                ) : (
                  <div className="space-y-2">
                    {empleados.map(emp => {
                      const checked = isSelected(emp.id)
                      const pct = totalPorcentaje(emp.id)
                      return (
                        <div
                          key={emp.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                            checked
                              ? 'bg-blue-600/10 border-blue-500/40'
                              : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                          }`}
                        >
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleEmpleado(emp.id)}
                            className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
                              checked ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-600 text-transparent'
                            }`}
                          >
                            ✓
                          </button>
                          {/* Avatar + nombre */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
                              {emp.nombre.charAt(0).toUpperCase()}
                            </span>
                            <span className={`text-sm truncate ${checked ? 'text-white' : 'text-gray-400'}`}>
                              {emp.nombre}
                            </span>
                          </div>
                          {/* Porcentaje — solo cuando seleccionado */}
                          {checked && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={pct}
                                onChange={e => setPorcentaje(emp.id, parseInt(e.target.value) || 0)}
                                onClick={e => e.stopPropagation()}
                                className="w-14 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-blue-500"
                              />
                              <span className="text-gray-400 text-xs">%</span>
                            </div>
                          )}
                        </div>
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
