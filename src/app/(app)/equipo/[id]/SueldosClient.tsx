'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Sueldo = {
  id: number
  id_empleado: string
  coste_total: number
  mes: number
  anio: number
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

type ModalState =
  | { mode: 'new' }
  | { mode: 'edit'; sueldo: Sueldo }

export default function SueldosClient({
  empleadoId,
  sueldos,
}: {
  empleadoId: string
  sueldos: Sueldo[]
}) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState | null>(null)
  const [form, setForm] = useState({ mes: '1', anio: String(new Date().getFullYear()), coste_total: '' })
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    const now = new Date()
    setForm({
      mes: String(now.getMonth() + 1),
      anio: String(now.getFullYear()),
      coste_total: '',
    })
    setModal({ mode: 'new' })
  }

  const openEdit = (s: Sueldo) => {
    setForm({
      mes: String(s.mes),
      anio: String(s.anio),
      coste_total: String(s.coste_total),
    })
    setModal({ mode: 'edit', sueldo: s })
  }

  const handleSave = async () => {
    const coste = parseFloat(form.coste_total)
    if (isNaN(coste) || coste < 0) return
    setSaving(true)
    if (modal?.mode === 'edit') {
      await fetch('/api/sueldos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modal.sueldo.id,
          coste_total: coste,
          mes: parseInt(form.mes),
          anio: parseInt(form.anio),
        }),
      })
    } else {
      await fetch('/api/sueldos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_empleado: empleadoId,
          coste_total: coste,
          mes: parseInt(form.mes),
          anio: parseInt(form.anio),
        }),
      })
    }
    setSaving(false)
    setModal(null)
    router.refresh()
  }

  const handleDelete = async (s: Sueldo) => {
    if (!window.confirm(`¿Eliminar el sueldo de ${MESES[s.mes - 1]} ${s.anio}?`)) return
    await fetch(`/api/sueldos?id=${s.id}`, { method: 'DELETE' })
    router.refresh()
  }

  // Group by year for display
  const byYear = new Map<number, Sueldo[]>()
  for (const s of sueldos) {
    const arr = byYear.get(s.anio) ?? []
    arr.push(s)
    byYear.set(s.anio, arr)
  }
  const years = [...byYear.keys()].sort((a, b) => b - a)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h3 className="text-white font-semibold text-lg">Sueldos</h3>
        <button
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + Añadir sueldo
        </button>
      </div>

      {sueldos.length === 0 ? (
        <p className="text-gray-500 text-sm p-6">Sin sueldos registrados. Añade el primero.</p>
      ) : (
        years.map(year => (
          <div key={year}>
            <div className="px-6 py-2 bg-gray-800/50 border-b border-gray-800">
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">{year}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                  <th className="text-left px-6 py-3">Mes</th>
                  <th className="text-right px-6 py-3">Coste total</th>
                  <th className="text-right px-6 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(byYear.get(year) ?? []).sort((a, b) => b.mes - a.mes).map(s => (
                  <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-3 text-white">{MESES[s.mes - 1]}</td>
                    <td className="px-6 py-3 text-right text-white font-medium">{fmt(s.coste_total)}</td>
                    <td className="px-6 py-3 text-right space-x-2">
                      <button
                        onClick={() => openEdit(s)}
                        className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 py-1.5 text-xs transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
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
        ))
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">
                {modal.mode === 'new' ? 'Añadir sueldo' : 'Editar sueldo'}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-white text-xl">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Mes</label>
                  <select
                    value={form.mes}
                    onChange={e => setForm(f => ({ ...f, mes: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {MESES.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Año</label>
                  <input
                    type="number"
                    value={form.anio}
                    onChange={e => setForm(f => ({ ...f, anio: e.target.value }))}
                    min={2020}
                    max={2099}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Coste total (€)</label>
                <input
                  type="number"
                  value={form.coste_total}
                  onChange={e => setForm(f => ({ ...f, coste_total: e.target.value }))}
                  placeholder="0"
                  min={0}
                  step={0.01}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setModal(null)}
                  className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.coste_total}
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
