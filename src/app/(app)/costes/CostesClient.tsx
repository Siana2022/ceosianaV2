'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface Departamento { id: string; nombre: string }

interface Gasto {
  id: string
  concepto: string
  valor: number
  tipo: 'general' | 'departamento'
  id_departamento: string | null
  departamento: { id: string; nombre: string } | null
  mes: number
  anio: number
}

interface SueldoRow {
  id: string | null
  id_empleado: string
  nombre: string
  coste_total: number | null
  mes: number
  anio: number
}

interface Props {
  gastos: Gasto[]
  sueldos: SueldoRow[]
  departamentos: Departamento[]
  mes: number
  anio: number
}

interface GastoForm {
  concepto: string
  valor: string
  tipo: 'general' | 'departamento'
  id_departamento: string
}

export default function CostesClient({ gastos, sueldos, departamentos, mes, anio }: Props) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  // Gasto modal
  const [showGastoModal, setShowGastoModal] = useState(false)
  const [gastoEditMode, setGastoEditMode] = useState(false)
  const [editGastoId, setEditGastoId] = useState<string | null>(null)
  const [gastoForm, setGastoForm] = useState<GastoForm>({ concepto: '', valor: '', tipo: 'general', id_departamento: '' })

  // Sueldo edit
  const [editSueldoId, setEditSueldoId] = useState<string | null>(null)
  const [sueldoValor, setSueldoValor] = useState('')

  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState('')

  const goTo = (m: number, y: number) => router.push(`/costes?mes=${m}&anio=${y}`)

  const openCreateGasto = () => {
    setGastoEditMode(false)
    setEditGastoId(null)
    setGastoForm({ concepto: '', valor: '', tipo: 'general', id_departamento: '' })
    setError('')
    setShowGastoModal(true)
  }

  const openEditGasto = (g: Gasto) => {
    setGastoEditMode(true)
    setEditGastoId(g.id)
    setGastoForm({ concepto: g.concepto, valor: String(g.valor), tipo: g.tipo, id_departamento: g.id_departamento ?? '' })
    setError('')
    setShowGastoModal(true)
  }

  const handleGastoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gastoForm.concepto.trim()) { setError('El concepto es obligatorio'); return }
    if (!gastoForm.valor) { setError('El valor es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const body = gastoEditMode
        ? { id: editGastoId, concepto: gastoForm.concepto, valor: parseFloat(gastoForm.valor), tipo: gastoForm.tipo, id_departamento: gastoForm.id_departamento || null, mes, anio }
        : { concepto: gastoForm.concepto, valor: parseFloat(gastoForm.valor), tipo: gastoForm.tipo, id_departamento: gastoForm.id_departamento || null, mes, anio }

      const res = await fetch('/api/costes', {
        method: gastoEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      setShowGastoModal(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  const handleDeleteGasto = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return
    await fetch(`/api/costes?id=${id}`, { method: 'DELETE' })
    router.refresh()
  }

  const handleCopiarMesAnterior = async () => {
    if (!confirm('¿Copiar los gastos fijos del mes anterior a este mes?')) return
    setCopying(true)
    try {
      const prevMes = mes === 1 ? 12 : mes - 1
      const prevAnio = mes === 1 ? anio - 1 : anio
      const res = await fetch(`/api/costes?mes=${prevMes}&anio=${prevAnio}`)
      const prevGastos: Gasto[] = await res.json()
      if (!Array.isArray(prevGastos) || prevGastos.length === 0) {
        alert('No hay gastos en el mes anterior')
        return
      }
      const records = prevGastos.map(g => ({
        concepto: g.concepto, valor: g.valor, tipo: g.tipo,
        id_departamento: g.id_departamento, mes, anio,
      }))
      await Promise.all(
        records.map(r =>
          fetch('/api/costes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(r),
          })
        )
      )
      router.refresh()
    } finally { setCopying(false) }
  }

  const startEditSueldo = (s: SueldoRow) => {
    setEditSueldoId(s.id_empleado)
    setSueldoValor(s.coste_total != null ? String(s.coste_total) : '')
  }

  const saveSueldo = async (s: SueldoRow) => {
    if (!sueldoValor) { setEditSueldoId(null); return }
    setSaving(true)
    try {
      await fetch('/api/sueldos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_empleado: s.id_empleado, coste_total: parseFloat(sueldoValor), mes, anio }),
      })
      setEditSueldoId(null)
      router.refresh()
    } finally { setSaving(false) }
  }

  const totalGastos = gastos.reduce((s, g) => s + Number(g.valor), 0)
  const totalSueldos = sueldos.reduce((s, r) => s + Number(r.coste_total ?? 0), 0)
  const totalCombinado = totalGastos + totalSueldos

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Costes</h2>
        <p className="text-gray-400 text-sm mt-1">{MESES[mes - 1]} {anio}</p>
      </div>

      {/* Month selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {years.map(y => (
            <button key={y} onClick={() => goTo(mes, y)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${y === anio ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
              {y}
            </button>
          ))}
          <span className="text-gray-600">|</span>
          {MESES_CORTO.map((m, i) => (
            <button key={i} onClick={() => goTo(i + 1, anio)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${mes === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Gastos fijos */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Gastos fijos</h3>
            <div className="flex items-center gap-2">
              <button onClick={handleCopiarMesAnterior} disabled={copying}
                className="text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 transition-colors">
                {copying ? 'Copiando...' : '↩ Copiar mes anterior'}
              </button>
              <button onClick={openCreateGasto}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                + Añadir gasto
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-6 py-3">Concepto</th>
                <th className="text-left px-6 py-3">Tipo</th>
                <th className="text-left px-6 py-3">Dpto.</th>
                <th className="text-right px-6 py-3">Valor</th>
                <th className="text-center px-6 py-3">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {gastos.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-8 text-sm">Sin gastos este mes</td></tr>
              )}
              {gastos.map(g => (
                <tr key={g.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-6 py-3 text-white">{g.concepto}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${g.tipo === 'general' ? 'bg-gray-700 text-gray-300' : 'bg-blue-900/50 text-blue-400'}`}>
                      {g.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-400 text-xs">{g.departamento?.nombre ?? '—'}</td>
                  <td className="px-6 py-3 text-right text-red-400 font-medium">{fmt(Number(g.valor))}</td>
                  <td className="px-6 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEditGasto(g)} className="text-gray-400 hover:text-white text-xs px-1.5 py-1 rounded hover:bg-gray-700">✎</button>
                      <button onClick={() => handleDeleteGasto(g.id)} className="text-red-500 hover:text-red-400 text-xs px-1.5 py-1 rounded hover:bg-gray-700">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {gastos.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-700 bg-gray-800/50">
                  <td colSpan={3} className="px-6 py-3 text-gray-400 text-sm font-medium">Total gastos</td>
                  <td className="px-6 py-3 text-right text-white font-bold">{fmt(totalGastos)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Sueldos */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Sueldos del mes</h3>
            <p className="text-gray-500 text-xs mt-0.5">Coste total por empleado</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-6 py-3">Empleado</th>
                <th className="text-right px-6 py-3">Coste total</th>
                <th className="text-center px-6 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sueldos.length === 0 && (
                <tr><td colSpan={3} className="text-center text-gray-500 py-8 text-sm">Sin empleados activos</td></tr>
              )}
              {sueldos.map(s => (
                <tr key={s.id_empleado} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-6 py-3 text-white">{s.nombre}</td>
                  <td className="px-6 py-3 text-right">
                    {editSueldoId === s.id_empleado ? (
                      <input
                        type="number"
                        min="0"
                        value={sueldoValor}
                        onChange={e => setSueldoValor(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveSueldo(s); if (e.key === 'Escape') setEditSueldoId(null) }}
                        className="bg-gray-800 border border-blue-500 rounded text-white px-2 py-1 text-sm w-28 text-right focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className={s.coste_total != null ? 'text-white font-medium' : 'text-gray-500'}>
                        {s.coste_total != null ? fmt(Number(s.coste_total)) : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {editSueldoId === s.id_empleado ? (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => saveSueldo(s)} disabled={saving} className="text-green-400 hover:text-green-300 text-xs px-2 py-1 rounded hover:bg-gray-700">✓</button>
                        <button onClick={() => setEditSueldoId(null)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditSueldo(s)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">Editar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {sueldos.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-700 bg-gray-800/50">
                  <td className="px-6 py-3 text-gray-400 text-sm font-medium">Total sueldos</td>
                  <td className="px-6 py-3 text-right text-white font-bold">{fmt(totalSueldos)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Combined total */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">Total costes combinados</p>
          <p className="text-gray-500 text-xs mt-0.5">Gastos {fmt(totalGastos)} + Sueldos {fmt(totalSueldos)}</p>
        </div>
        <p className="text-2xl font-bold text-white">{fmt(totalCombinado)}</p>
      </div>

      {/* Modal: Gasto */}
      {showGastoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">{gastoEditMode ? 'Editar gasto' : 'Añadir gasto fijo'}</h3>
              <button onClick={() => setShowGastoModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={handleGastoSubmit}>
              <div className="p-6 space-y-4">
                {error && <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm">{error}</div>}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Concepto *</label>
                  <input type="text" value={gastoForm.concepto} onChange={e => setGastoForm(f => ({ ...f, concepto: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Valor (€) *</label>
                    <input type="number" min="0" step="0.01" value={gastoForm.valor} onChange={e => setGastoForm(f => ({ ...f, valor: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Tipo</label>
                    <select value={gastoForm.tipo} onChange={e => setGastoForm(f => ({ ...f, tipo: e.target.value as 'general' | 'departamento' }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      <option value="general">General</option>
                      <option value="departamento">Departamento</option>
                    </select>
                  </div>
                </div>
                {gastoForm.tipo === 'departamento' && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Departamento</label>
                    <select value={gastoForm.id_departamento} onChange={e => setGastoForm(f => ({ ...f, id_departamento: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      <option value="">Seleccionar...</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
                <button type="button" onClick={() => setShowGastoModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Guardando...' : gastoEditMode ? 'Guardar' : 'Añadir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
