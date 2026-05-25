'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'

type Sueldo = {
  id: number
  id_empleado: string
  coste_total: number
  mes: number
  anio: number
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

type ModalState = { mode: 'new' } | { mode: 'edit'; sueldo: Sueldo }

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
  const [todoElAnio, setTodoElAnio] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const openNew = () => {
    const now = new Date()
    setForm({ mes: String(now.getMonth() + 1), anio: String(now.getFullYear()), coste_total: '' })
    setTodoElAnio(false)
    setModal({ mode: 'new' })
  }

  const openEdit = (s: Sueldo) => {
    setForm({ mes: String(s.mes), anio: String(s.anio), coste_total: String(s.coste_total) })
    setTodoElAnio(false)
    setModal({ mode: 'edit', sueldo: s })
  }

  const handleSave = async () => {
    const coste = parseFloat(form.coste_total)
    if (isNaN(coste) || coste < 0) return
    setSaving(true)

    if (modal?.mode === 'edit') {
      // Always single-month when editing
      await fetch('/api/sueldos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modal.sueldo.id, coste_total: coste, mes: parseInt(form.mes), anio: parseInt(form.anio) }),
      })
    } else if (todoElAnio) {
      // Save all 12 months in parallel (upsert — overwrites existing)
      await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          fetch('/api/sueldos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_empleado: empleadoId, coste_total: coste, mes: i + 1, anio: parseInt(form.anio) }),
          })
        )
      )
    } else {
      // Single month
      await fetch('/api/sueldos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_empleado: empleadoId, coste_total: coste, mes: parseInt(form.mes), anio: parseInt(form.anio) }),
      })
    }

    setSaving(false)
    setModal(null)
    router.refresh()
  }

  const handleDelete = (s: Sueldo) => {
    setConfirmModal({
      title: 'Eliminar sueldo',
      message: `¿Eliminar el sueldo de ${MESES[s.mes - 1]} ${s.anio}?`,
      onConfirm: async () => {
        setConfirmModal(null)
        await fetch(`/api/sueldos?id=${s.id}`, { method: 'DELETE' })
        router.refresh()
      },
    })
  }

  // Group by year for display
  const byYear = new Map<number, Sueldo[]>()
  for (const s of sueldos) {
    const arr = byYear.get(s.anio) ?? []
    arr.push(s)
    byYear.set(s.anio, arr)
  }
  const years = [...byYear.keys()].sort((a, b) => b - a)

  // For "todo el año" warning: how many months of that year already have data
  const anioSeleccionado = parseInt(form.anio)
  const mesesConDatos = (byYear.get(anioSeleccionado) ?? []).map(s => s.mes)

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title ?? ''}
        message={confirmModal?.message ?? ''}
        onConfirm={confirmModal?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmModal(null)}
      />
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
        years.map(year => {
          const sueldosAnio = (byYear.get(year) ?? []).sort((a, b) => a.mes - b.mes)
          const totalAnio = sueldosAnio.reduce((s, r) => s + r.coste_total, 0)
          const mesesRegistrados = sueldosAnio.length

          return (
            <div key={year}>
              <div className="px-6 py-2 bg-gray-800/50 border-b border-gray-800 flex items-center justify-between">
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">{year}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs">{mesesRegistrados}/12 meses</span>
                  <span className="text-white text-xs font-semibold">{fmt(totalAnio)}</span>
                </div>
              </div>

              {/* 12-month grid */}
              <div className="grid grid-cols-6 gap-px bg-gray-800 border-b border-gray-800">
                {Array.from({ length: 12 }, (_, i) => {
                  const mes = i + 1
                  const s = sueldosAnio.find(r => r.mes === mes)
                  return (
                    <div
                      key={mes}
                      className="bg-gray-900 px-3 py-3 hover:bg-gray-800/50 cursor-pointer group"
                      onClick={() => s ? openEdit(s) : openNew()}
                    >
                      <p className="text-gray-500 text-[10px] font-medium mb-1">{MESES_CORTO[i]}</p>
                      {s ? (
                        <p className="text-white text-xs font-semibold">{fmt(s.coste_total)}</p>
                      ) : (
                        <p className="text-gray-700 text-xs group-hover:text-gray-500">—</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Detailed table */}
              <table className="w-full text-sm">
                <tbody>
                  {sueldosAnio.map(s => (
                    <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-6 py-3 text-white">{MESES[s.mes - 1]}</td>
                      <td className="px-6 py-3 text-right text-white font-medium">{fmt(s.coste_total)}</td>
                      <td className="px-6 py-3 text-right space-x-2">
                        <button onClick={() => openEdit(s)} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 py-1.5 text-xs transition-colors">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(s)} className="bg-red-900/50 hover:bg-red-800 text-red-400 hover:text-white rounded-lg px-3 py-1.5 text-xs transition-colors">
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">
                {modal.mode === 'new' ? 'Añadir sueldo' : 'Editar sueldo'}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Año siempre visible */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Año</label>
                <input
                  type="number"
                  value={form.anio}
                  onChange={e => setForm(f => ({ ...f, anio: e.target.value }))}
                  min={2020} max={2099}
                  className={inputCls}
                />
              </div>

              {/* Toggle "todo el año" — solo en modo nuevo */}
              {modal.mode === 'new' && (
                <button
                  type="button"
                  onClick={() => setTodoElAnio(v => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-colors ${
                    todoElAnio
                      ? 'bg-green-900/20 border-green-600/50 text-green-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{todoElAnio ? '✅' : '☐'}</span>
                    <span>Mismo sueldo para todo el año {form.anio}</span>
                  </div>
                  {todoElAnio && (
                    <span className="text-green-400 text-xs">Ene → Dic</span>
                  )}
                </button>
              )}

              {/* Selector de mes — solo si NO es todo el año */}
              {!todoElAnio && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Mes</label>
                  <select
                    value={form.mes}
                    onChange={e => setForm(f => ({ ...f, mes: e.target.value }))}
                    className={inputCls}
                  >
                    {MESES.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Importe */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Coste total mensual (€)</label>
                <input
                  type="number"
                  value={form.coste_total}
                  onChange={e => setForm(f => ({ ...f, coste_total: e.target.value }))}
                  placeholder="0"
                  min={0}
                  step={0.01}
                  className={inputCls}
                  autoFocus
                />
              </div>

              {/* Aviso si hay meses con datos y se va a sobrescribir */}
              {todoElAnio && mesesConDatos.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-4 py-3 text-xs text-yellow-400">
                  ⚠️ {mesesConDatos.length} {mesesConDatos.length === 1 ? 'mes ya tiene' : 'meses ya tienen'} sueldo en {form.anio} y{' '}
                  <span className="font-semibold">se sobrescribirán</span>:{' '}
                  {mesesConDatos.map(m => MESES_CORTO[m - 1]).join(', ')}
                </div>
              )}

              {todoElAnio && form.coste_total && (
                <div className="bg-gray-800 rounded-lg px-4 py-3 text-xs text-gray-400">
                  Total anual estimado:{' '}
                  <span className="text-white font-semibold">
                    {fmt(parseFloat(form.coste_total) * 12)}
                  </span>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <button onClick={() => setModal(null)} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm">
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.coste_total}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium"
                >
                  {saving
                    ? 'Guardando…'
                    : todoElAnio
                      ? `Guardar 12 meses`
                      : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
