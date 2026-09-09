'use client'

import { useState, useCallback } from 'react'

type Estado = 'descubrimiento' | 'propuesta' | 'negociacion' | 'ganado' | 'perdido'

interface Empleado { id: string; nombre: string }

interface Prospecto {
  id: string
  nombre: string
  estado: Estado
  responsable_captacion: string | null
  responsable_seguimiento: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  notas: string | null
  activo: boolean
  created_at: string
}

const COLUMNAS: { key: Estado; label: string; color: string; bg: string }[] = [
  { key: 'descubrimiento', label: 'Descubrimiento', color: 'text-sky-400', bg: 'bg-sky-900/20 border-sky-800/40' },
  { key: 'propuesta', label: 'Propuesta', color: 'text-violet-400', bg: 'bg-violet-900/20 border-violet-800/40' },
  { key: 'negociacion', label: 'Negociación', color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-800/40' },
  { key: 'ganado', label: 'Ganado', color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-800/40' },
  { key: 'perdido', label: 'Perdido', color: 'text-red-400', bg: 'bg-red-900/20 border-red-800/40' },
]

const EMPTY: Omit<Prospecto, 'id' | 'created_at'> = {
  nombre: '',
  estado: 'descubrimiento',
  responsable_captacion: null,
  responsable_seguimiento: null,
  fecha_inicio: null,
  fecha_fin: null,
  notas: null,
  activo: true,
}

export default function PipelineClient({ initialProspectos, empleados }: {
  initialProspectos: Prospecto[]
  empleados: Empleado[]
}) {
  const [prospectos, setProspectos] = useState<Prospecto[]>(initialProspectos)
  const [modal, setModal] = useState<{ open: boolean; prospecto: Partial<Prospecto> | null; isNew: boolean }>({
    open: false, prospecto: null, isNew: false,
  })
  const [saving, setSaving] = useState(false)
  const [showInactivos, setShowInactivos] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openNew = (estado?: Estado) => {
    setModal({ open: true, prospecto: { ...EMPTY, estado: estado ?? 'descubrimiento' }, isNew: true })
    setError(null)
  }

  const openEdit = (p: Prospecto) => {
    setModal({ open: true, prospecto: { ...p }, isNew: false })
    setError(null)
  }

  const closeModal = () => setModal({ open: false, prospecto: null, isNew: false })

  const moveEstado = useCallback(async (id: string, estado: Estado) => {
    const res = await fetch(`/api/pipeline?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    if (!res.ok) return
    const updated = await res.json()
    setProspectos(ps => ps.map(p => p.id === id ? { ...p, ...updated } : p))
  }, [])

  const handleSave = async () => {
    if (!modal.prospecto?.nombre?.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError(null)
    try {
      const url = modal.isNew ? '/api/pipeline' : `/api/pipeline?id=${modal.prospecto!.id}`
      const method = modal.isNew ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: modal.prospecto!.nombre,
          estado: modal.prospecto!.estado,
          responsable_captacion: modal.prospecto!.responsable_captacion || null,
          responsable_seguimiento: modal.prospecto!.responsable_seguimiento || null,
          fecha_inicio: modal.prospecto!.fecha_inicio || null,
          fecha_fin: modal.prospecto!.fecha_fin || null,
          notas: modal.prospecto!.notas || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      const saved = await res.json()
      if (modal.isNew) {
        setProspectos(ps => [saved, ...ps])
      } else {
        setProspectos(ps => ps.map(p => p.id === saved.id ? { ...p, ...saved } : p))
      }
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este prospecto?')) return
    const res = await fetch(`/api/pipeline?id=${id}`, { method: 'DELETE' })
    if (res.ok) setProspectos(ps => ps.filter(p => p.id !== id))
  }

  const empNombre = (id: string | null) => empleados.find(e => e.id === id)?.nombre ?? '—'

  const visibles = prospectos.filter(p => showInactivos ? true : p.activo)

  // Stats
  const total = prospectos.filter(p => p.activo || p.estado === 'ganado' || p.estado === 'perdido').length
  const ganados = prospectos.filter(p => p.estado === 'ganado').length
  const perdidos = prospectos.filter(p => p.estado === 'perdido').length
  const tasaCierre = total > 0 ? Math.round((ganados / total) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de prospectos y oportunidades comerciales</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactivos}
              onChange={e => setShowInactivos(e.target.checked)}
              className="rounded"
            />
            Ver perdidos/inactivos
          </label>
          <button
            onClick={() => openNew()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Nuevo prospecto
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total prospectos', value: total },
          { label: 'Ganados', value: ganados, color: 'text-emerald-400' },
          { label: 'Perdidos', value: perdidos, color: 'text-red-400' },
          { label: 'Tasa de cierre', value: `${tasaCierre}%`, color: tasaCierre >= 50 ? 'text-emerald-400' : 'text-amber-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color ?? 'text-white'}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-5 gap-3">
        {COLUMNAS.map(col => {
          const cards = visibles.filter(p => p.estado === col.key)
          return (
            <div key={col.key} className={`rounded-xl border p-3 space-y-2 ${col.bg} min-h-[200px]`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>{col.label}</h3>
                <span className="text-xs text-gray-500 font-mono">{cards.length}</span>
              </div>

              {cards.map(p => (
                <ProspectoCard
                  key={p.id}
                  prospecto={p}
                  empNombre={empNombre}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onMove={moveEstado}
                  columnas={COLUMNAS}
                />
              ))}

              {col.key !== 'ganado' && col.key !== 'perdido' && (
                <button
                  onClick={() => openNew(col.key)}
                  className="w-full text-xs text-gray-600 hover:text-gray-400 py-2 border border-dashed border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
                >
                  + Añadir
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal.open && modal.prospecto && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white">{modal.isNew ? 'Nuevo prospecto' : 'Editar prospecto'}</h2>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nombre *</label>
                <input
                  type="text"
                  value={modal.prospecto.nombre ?? ''}
                  onChange={e => setModal(m => ({ ...m, prospecto: { ...m.prospecto!, nombre: e.target.value } }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Nombre del prospecto"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Estado</label>
                <select
                  value={modal.prospecto.estado ?? 'descubrimiento'}
                  onChange={e => setModal(m => ({ ...m, prospecto: { ...m.prospecto!, estado: e.target.value as Estado } }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {COLUMNAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Responsable captación</label>
                  <select
                    value={modal.prospecto.responsable_captacion ?? ''}
                    onChange={e => setModal(m => ({ ...m, prospecto: { ...m.prospecto!, responsable_captacion: e.target.value || null } }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">— Sin asignar</option>
                    {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Responsable seguimiento</label>
                  <select
                    value={modal.prospecto.responsable_seguimiento ?? ''}
                    onChange={e => setModal(m => ({ ...m, prospecto: { ...m.prospecto!, responsable_seguimiento: e.target.value || null } }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">— Sin asignar</option>
                    {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Fecha inicio</label>
                  <input
                    type="date"
                    value={modal.prospecto.fecha_inicio ?? ''}
                    onChange={e => setModal(m => ({ ...m, prospecto: { ...m.prospecto!, fecha_inicio: e.target.value || null } }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Fecha fin</label>
                  <input
                    type="date"
                    value={modal.prospecto.fecha_fin ?? ''}
                    onChange={e => setModal(m => ({ ...m, prospecto: { ...m.prospecto!, fecha_fin: e.target.value || null } }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Notas</label>
                <textarea
                  value={modal.prospecto.notas ?? ''}
                  onChange={e => setModal(m => ({ ...m, prospecto: { ...m.prospecto!, notas: e.target.value || null } }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none"
                  rows={3}
                  placeholder="Notas sobre el prospecto..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProspectoCard({ prospecto, empNombre, onEdit, onDelete, onMove, columnas }: {
  prospecto: Prospecto
  empNombre: (id: string | null) => string
  onEdit: (p: Prospecto) => void
  onDelete: (id: string) => void
  onMove: (id: string, estado: Estado) => void
  columnas: typeof COLUMNAS
}) {
  const [showMover, setShowMover] = useState(false)

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2 ${!prospecto.activo ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white leading-snug">{prospecto.nombre}</p>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(prospecto)} className="text-gray-500 hover:text-gray-300 text-xs p-0.5" title="Editar">✏️</button>
          <button onClick={() => onDelete(prospecto.id)} className="text-gray-500 hover:text-red-400 text-xs p-0.5" title="Eliminar">🗑️</button>
        </div>
      </div>

      {prospecto.responsable_captacion && (
        <p className="text-xs text-gray-500">
          <span className="text-gray-600">Captación:</span> {empNombre(prospecto.responsable_captacion)}
        </p>
      )}
      {prospecto.responsable_seguimiento && (
        <p className="text-xs text-gray-500">
          <span className="text-gray-600">Seguimiento:</span> {empNombre(prospecto.responsable_seguimiento)}
        </p>
      )}
      {prospecto.fecha_inicio && (
        <p className="text-xs text-gray-600">{prospecto.fecha_inicio}{prospecto.fecha_fin ? ` → ${prospecto.fecha_fin}` : ''}</p>
      )}
      {prospecto.notas && (
        <p className="text-xs text-gray-500 italic line-clamp-2">{prospecto.notas}</p>
      )}

      {/* Mover a otro estado */}
      <div className="pt-1">
        {!showMover ? (
          <button
            onClick={() => setShowMover(true)}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Mover →
          </button>
        ) : (
          <div className="flex flex-wrap gap-1">
            {columnas.filter(c => c.key !== prospecto.estado).map(c => (
              <button
                key={c.key}
                onClick={() => { onMove(prospecto.id, c.key); setShowMover(false) }}
                className={`text-[10px] px-1.5 py-0.5 rounded border ${c.color} border-current hover:bg-white/5 transition-colors`}
              >
                {c.label}
              </button>
            ))}
            <button onClick={() => setShowMover(false)} className="text-[10px] text-gray-600 hover:text-gray-400">✕</button>
          </div>
        )}
      </div>
    </div>
  )
}
