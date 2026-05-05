'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

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
  rentabilidad,
  anio,
}: {
  departamentos: Departamento[]
  rentabilidad: DeptRentabilidad[]
  anio: number
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Departamento | null>(null)
  const [nombre, setNombre] = useState('')
  const [activo, setActivo] = useState(true)
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    setEditing(null)
    setNombre('')
    setActivo(true)
    setShowModal(true)
  }

  const openEdit = (d: Departamento) => {
    setEditing(d)
    setNombre(d.nombre)
    setActivo(d.activo)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    const body = { nombre: nombre.trim(), activo }
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
          <p className="text-gray-400 text-sm mt-1">
            {departamentos.length} departamentos · la dedicación se gestiona desde la sección Dedicación
          </p>
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
                  <tr
                    key={r.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                    onClick={() => router.push(`/departamentos/${r.id}`)}
                  >
                    <td className="px-4 py-3 text-white font-medium hover:text-blue-400 transition-colors">{r.nombre}</td>
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
        {departamentos.map(d => {
          const rent = rentabilidad.find(r => r.id === d.id)
          return (
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
                <div className="space-y-1.5">
                  {d.miembros.slice(0, 4).map(m => (
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
                  {d.miembros.length > 4 && (
                    <p className="text-gray-600 text-xs">+{d.miembros.length - 4} más…</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-600 text-xs italic">Sin miembros asignados</p>
              )}

              {/* KPIs if available */}
              {rent && (rent.ingresos > 0 || rent.costTotal > 0) && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-800">
                  <div>
                    <p className="text-gray-500 text-[10px]">Ingresos</p>
                    <p className="text-green-400 text-xs font-semibold">{fmt(rent.ingresos)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[10px]">Resultado</p>
                    <p className={`text-xs font-semibold ${rent.resultado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(rent.resultado)}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t border-gray-800">
                <button
                  onClick={() => router.push(`/departamentos/${d.id}`)}
                  className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  Ver detalle →
                </button>
                <button
                  onClick={() => openEdit(d)}
                  className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
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
          )
        })}
      </div>

      {/* Modal: add/edit department */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">
                {editing ? 'Editar departamento' : 'Nuevo departamento'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
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

              {/* Activo toggle */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Estado</label>
                <button
                  type="button"
                  onClick={() => setActivo(v => !v)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors w-full ${
                    activo
                      ? 'bg-green-900/20 border-green-700/50 text-green-300'
                      : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <span className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${activo ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-4' : 'translate-x-0'}`} />
                  </span>
                  <span>{activo ? 'Activo' : 'Inactivo'}</span>
                </button>
              </div>

              <p className="text-gray-600 text-xs">
                Para asignar empleados a este departamento, usa la sección <strong className="text-gray-500">Dedicación</strong>.
              </p>
            </div>

            <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-800">
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
