'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface Lookup { id: string; nombre: string }

interface Ingreso {
  id: string
  concepto: string
  valor: number
  mes: number
  anio: number
  id_cliente: string | null
  id_servicio: string | null
  id_departamento: string | null
  id_responsable: string | null
  notas: string | null
  cliente: Lookup | null
  servicio: Lookup | null
  departamento: Lookup | null
  responsable: Lookup | null
}

interface ServicioActivo {
  id: string
  id_cliente: string
  nombre: string
  notas?: string | null
  precio_base: number | null
  id_departamento: string | null
  id_responsable: string | null
}

interface Props {
  ingresos: Ingreso[]
  serviciosActivos: ServicioActivo[]
  clientes: Lookup[]
  departamentos: Lookup[]
  empleados: Lookup[]
  mes: number
  anio: number
}

interface IngresoForm {
  id_cliente: string
  concepto: string
  id_servicio: string
  valor: string
  id_departamento: string
  id_responsable: string
  notas: string
}

const emptyForm = (): IngresoForm => ({
  id_cliente: '', concepto: '', id_servicio: '', valor: '', id_departamento: '', id_responsable: '', notas: '',
})

export default function IngresosClient({
  ingresos, serviciosActivos, clientes, departamentos, empleados, mes, anio,
}: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<IngresoForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showGenConfirm, setShowGenConfirm] = useState(false)
  const [generating, setGenerating] = useState(false)

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  const goTo = (m: number, y: number) => {
    router.push(`/ingresos?mes=${m}&anio=${y}`)
  }

  const serviciosForCliente = form.id_cliente
    ? serviciosActivos.filter(s => s.id_cliente === form.id_cliente)
    : []

  const openCreate = () => {
    setEditMode(false)
    setEditId(null)
    setForm(emptyForm())
    setError('')
    setShowModal(true)
  }

  const openEdit = (i: Ingreso) => {
    setEditMode(true)
    setEditId(i.id)
    setForm({
      id_cliente: i.id_cliente ?? '',
      concepto: i.concepto,
      id_servicio: i.id_servicio ?? '',
      valor: String(i.valor),
      id_departamento: i.id_departamento ?? '',
      id_responsable: i.id_responsable ?? '',
      notas: i.notas ?? '',
    })
    setError('')
    setShowModal(true)
  }

  const handleServicioChange = (id: string) => {
    const s = serviciosActivos.find(sv => sv.id === id)
    setForm(f => ({
      ...f,
      id_servicio: id,
      concepto: s ? s.nombre : f.concepto,
      valor: s?.precio_base != null ? String(s.precio_base) : f.valor,
      id_departamento: s?.id_departamento ?? f.id_departamento,
      id_responsable: s?.id_responsable ?? f.id_responsable,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.concepto.trim()) { setError('El concepto es obligatorio'); return }
    if (!form.valor) { setError('El valor es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const body = editMode
        ? { id: editId, concepto: form.concepto, valor: parseFloat(form.valor), id_cliente: form.id_cliente || null, id_servicio: form.id_servicio || null, id_departamento: form.id_departamento || null, id_responsable: form.id_responsable || null, notas: form.notas || null, mes, anio }
        : { concepto: form.concepto, valor: parseFloat(form.valor), id_cliente: form.id_cliente || null, id_servicio: form.id_servicio || null, id_departamento: form.id_departamento || null, id_responsable: form.id_responsable || null, notas: form.notas || null, mes, anio }

      const res = await fetch('/api/ingresos', {
        method: editMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      setShowModal(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este ingreso?')) return
    await fetch(`/api/ingresos?id=${id}`, { method: 'DELETE' })
    router.refresh()
  }

  // Generar desde servicios
  const existingServiceIds = new Set(ingresos.map(i => i.id_servicio).filter(Boolean))
  const serviciosPorGenerar = serviciosActivos.filter(s => !existingServiceIds.has(s.id))

  const handleGenerar = async () => {
    setGenerating(true)
    try {
      const records = serviciosPorGenerar.map(s => ({
        id_cliente: s.id_cliente,
        id_servicio: s.id,
        concepto: s.nombre,
        valor: s.precio_base ?? 0,
        id_departamento: s.id_departamento ?? null,
        id_responsable: s.id_responsable ?? null,
        mes,
        anio,
      }))
      const res = await fetch('/api/ingresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records),
      })
      if (!res.ok) { alert('Error al generar ingresos'); return }
      setShowGenConfirm(false)
      router.refresh()
    } finally { setGenerating(false) }
  }

  const total = ingresos.reduce((s, i) => s + Number(i.valor), 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Ingresos</h2>
          <p className="text-gray-400 text-sm mt-1">{MESES[mes - 1]} {anio}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGenConfirm(true)}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            ⚡ Generar desde servicios
          </button>
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Añadir ingreso
          </button>
        </div>
      </div>

      {/* Year/Month selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {years.map(y => (
            <button
              key={y}
              onClick={() => goTo(mes, y)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                y === anio ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              {y}
            </button>
          ))}
          <span className="text-gray-600">|</span>
          {MESES_CORTO.map((m, i) => (
            <button
              key={i}
              onClick={() => goTo(i + 1, anio)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                mes === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-6 py-3">Cliente</th>
              <th className="text-left px-6 py-3">Concepto / Servicio</th>
              <th className="text-left px-6 py-3">Departamento</th>
              <th className="text-left px-6 py-3">Responsable</th>
              <th className="text-right px-6 py-3">Valor</th>
              <th className="text-center px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ingresos.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-500 py-12">Sin ingresos para este período</td></tr>
            )}
            {ingresos.map(i => (
              <tr key={i.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-6 py-3 text-gray-300">{i.cliente?.nombre ?? <span className="text-gray-600">—</span>}</td>
                <td className="px-6 py-3">
                  <span className="text-white">{i.concepto}</span>
                  {i.servicio && <span className="block text-gray-500 text-xs">{i.servicio.nombre}</span>}
                </td>
                <td className="px-6 py-3 text-gray-300">{i.departamento?.nombre ?? <span className="text-gray-600">—</span>}</td>
                <td className="px-6 py-3 text-gray-300">{i.responsable?.nombre ?? <span className="text-gray-600">—</span>}</td>
                <td className="px-6 py-3 text-right text-green-400 font-semibold">{fmt(Number(i.valor))}</td>
                <td className="px-6 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => openEdit(i)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">Editar</button>
                    <button onClick={() => handleDelete(i.id)} className="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-gray-700">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {ingresos.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-800/50">
                <td colSpan={4} className="px-6 py-3 text-gray-400 font-medium text-sm">Total facturación</td>
                <td className="px-6 py-3 text-right text-white font-bold">{fmt(total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Modal: Add/Edit ingreso */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">{editMode ? 'Editar ingreso' : 'Añadir ingreso'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {error && <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm">{error}</div>}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Cliente</label>
                  <select value={form.id_cliente} onChange={e => setForm(f => ({ ...f, id_cliente: e.target.value, id_servicio: '' }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sin cliente</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                {serviciosForCliente.length > 0 && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Servicio (opcional)</label>
                    <select value={form.id_servicio} onChange={e => handleServicioChange(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      <option value="">Sin servicio</option>
                      {serviciosForCliente.map(s => <option key={s.id} value={s.id}>{s.notas ? `${s.nombre} · ${s.notas}` : s.nombre}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Concepto *</label>
                  <input type="text" value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Valor (€) *</label>
                  <input type="number" min="0" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="0" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Departamento</label>
                  <select value={form.id_departamento} onChange={e => setForm(f => ({ ...f, id_departamento: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sin departamento</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Responsable</label>
                  <select value={form.id_responsable} onChange={e => setForm(f => ({ ...f, id_responsable: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sin responsable</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Notas</label>
                  <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Guardando...' : editMode ? 'Guardar' : 'Añadir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm generar */}
      {showGenConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">Generar desde servicios</h3>
              <button onClick={() => setShowGenConfirm(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6">
              {serviciosPorGenerar.length === 0 ? (
                <p className="text-gray-400 text-sm">Todos los servicios recurrentes ya tienen ingreso este mes.</p>
              ) : (
                <>
                  <p className="text-gray-300 text-sm mb-4">
                    Se crearán <span className="text-white font-bold">{serviciosPorGenerar.length}</span> ingresos para {MESES[mes - 1]} {anio}:
                  </p>
                  <ul className="space-y-1 mb-4 max-h-48 overflow-y-auto">
                    {serviciosPorGenerar.map(s => (
                      <li key={s.id} className="text-gray-400 text-sm flex justify-between">
                        <span>{s.nombre}</span>
                        <span className="text-green-400">{fmt(s.precio_base ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => setShowGenConfirm(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
              {serviciosPorGenerar.length > 0 && (
                <button onClick={handleGenerar} disabled={generating}
                  className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {generating ? 'Generando...' : 'Confirmar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
