'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Columna = { id: string; id_board: string; nombre: string; orden: number; color: string }
type Ficha = {
  id: string; id_board: string; id_columna: string
  titulo: string | null; copy: string | null; canal: string
  fecha_publicacion: string | null; imagen_url: string | null; orden: number
}

const CANALES: Record<string, { label: string; emoji: string }> = {
  instagram: { label: 'Instagram', emoji: '📸' },
  facebook: { label: 'Facebook', emoji: '📘' },
  linkedin: { label: 'LinkedIn', emoji: '💼' },
  tiktok: { label: 'TikTok', emoji: '🎵' },
  blog: { label: 'Blog', emoji: '✍️' },
  otro: { label: 'Otro', emoji: '🌐' },
}

// ─── FichaCard ───────────────────────────────────────────────────────────────
function FichaCard({
  ficha,
  onEdit,
  onDelete,
}: {
  ficha: Ficha
  onEdit: (f: Ficha) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ficha.id, data: { type: 'ficha', ficha } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const canal = CANALES[ficha.canal] ?? CANALES.otro

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing select-none group"
      {...attributes}
      {...listeners}
    >
      {ficha.imagen_url && (
        <img
          src={ficha.imagen_url}
          alt=""
          className="w-full h-28 object-cover rounded mb-2 pointer-events-none"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-white font-medium leading-tight flex-1 min-w-0 truncate">
          {ficha.titulo || <span className="text-gray-500 italic">Sin título</span>}
        </p>
        <div
          className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onPointerDown={e => e.stopPropagation()}
        >
          <button
            onClick={() => onEdit(ficha)}
            className="text-gray-400 hover:text-blue-400 text-xs p-0.5"
            title="Editar"
          >✏️</button>
          <button
            onClick={() => onDelete(ficha.id)}
            className="text-gray-400 hover:text-red-400 text-xs p-0.5"
            title="Eliminar"
          >🗑️</button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <span className="text-xs text-gray-400">{canal.emoji} {canal.label}</span>
        {ficha.fecha_publicacion && (
          <span className="text-xs text-gray-500">
            {new Date(ficha.fecha_publicacion + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Columna ────────────────────────────────────────────────────────────────
function ColumnaBoard({
  columna,
  fichas,
  onAddFicha,
  onEditFicha,
  onDeleteFicha,
  onEditColumna,
  onDeleteColumna,
}: {
  columna: Columna
  fichas: Ficha[]
  onAddFicha: (id_columna: string) => void
  onEditFicha: (f: Ficha) => void
  onDeleteFicha: (id: string) => void
  onEditColumna: (c: Columna) => void
  onDeleteColumna: (id: string) => void
}) {
  const { setNodeRef } = useSortable({ id: columna.id, data: { type: 'columna' } })
  const fichaIds = fichas.map(f => f.id)

  return (
    <div ref={setNodeRef} className="flex flex-col w-72 shrink-0 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700" style={{ borderTopWidth: 3, borderTopColor: columna.color }}>
        <span className="font-semibold text-white text-sm">{columna.nombre}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">{fichas.length}</span>
          <button onClick={() => onEditColumna(columna)} className="text-gray-500 hover:text-gray-300 text-xs">✏️</button>
          <button onClick={() => onDeleteColumna(columna.id)} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 flex flex-col gap-2 p-3 min-h-[120px]">
        <SortableContext items={fichaIds} strategy={verticalListSortingStrategy}>
          {fichas.map(f => (
            <FichaCard key={f.id} ficha={f} onEdit={onEditFicha} onDelete={onDeleteFicha} />
          ))}
        </SortableContext>
      </div>

      {/* Add card button */}
      <button
        onClick={() => onAddFicha(columna.id)}
        className="mx-3 mb-3 py-2 text-sm text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition-colors border border-dashed border-gray-700 hover:border-blue-500"
      >
        + Añadir ficha
      </button>
    </div>
  )
}

// ─── FichaModal ──────────────────────────────────────────────────────────────
function FichaModal({
  ficha,
  columnas,
  onSave,
  onClose,
}: {
  ficha: Partial<Ficha> & { id_columna: string }
  columnas: Columna[]
  onSave: (data: Partial<Ficha>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    titulo: ficha.titulo ?? '',
    copy: ficha.copy ?? '',
    canal: ficha.canal ?? 'instagram',
    fecha_publicacion: ficha.fecha_publicacion ?? '',
    imagen_url: ficha.imagen_url ?? '',
    id_columna: ficha.id_columna,
  })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/editorial/imagenes', { method: 'POST', body: fd })
      if (!res.ok) {
        const d = await res.json()
        setUploadError(d.error ?? 'Error al subir')
      } else {
        const { url } = await res.json()
        setForm(s => ({ ...s, imagen_url: url }))
      }
    } catch {
      setUploadError('Error de red')
    } finally {
      setUploading(false)
    }
  }

  function removeImage() {
    setForm(s => ({ ...s, imagen_url: '' }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
          <h3 className="text-white font-semibold">{ficha.id ? 'Editar ficha' : 'Nueva ficha'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Título</label>
            <input
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
              value={form.titulo}
              onChange={e => setForm(s => ({ ...s, titulo: e.target.value }))}
              placeholder="Título del contenido"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Copy</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none resize-none"
              rows={4}
              value={form.copy}
              onChange={e => setForm(s => ({ ...s, copy: e.target.value }))}
              placeholder="Texto del post..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Canal</label>
              <select
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                value={form.canal}
                onChange={e => setForm(s => ({ ...s, canal: e.target.value }))}
              >
                {Object.entries(CANALES).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Fecha publicación</label>
              <input
                type="date"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                value={form.fecha_publicacion}
                onChange={e => setForm(s => ({ ...s, fecha_publicacion: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Columna</label>
            <select
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
              value={form.id_columna}
              onChange={e => setForm(s => ({ ...s, id_columna: e.target.value }))}
            >
              {columnas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Image upload */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Imagen cover</label>
            {form.imagen_url ? (
              <div className="relative rounded-lg overflow-hidden">
                <img
                  src={form.imagen_url}
                  alt="Cover"
                  className="w-full h-40 object-cover"
                />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm transition-colors"
                  title="Eliminar imagen"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploading ? 'border-blue-500 bg-blue-900/10' : 'border-gray-600 hover:border-blue-500 hover:bg-gray-800'}`}>
                {uploading ? (
                  <span className="text-blue-400 text-sm animate-pulse">Subiendo...</span>
                ) : (
                  <>
                    <span className="text-2xl mb-1">🖼️</span>
                    <span className="text-sm text-gray-400">Haz clic para subir imagen</span>
                    <span className="text-xs text-gray-600 mt-0.5">JPG, PNG, GIF, WebP</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
            )}
            {uploadError && (
              <p className="text-xs text-red-400 mt-1">{uploadError}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={uploading}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── BoardClient ─────────────────────────────────────────────────────────────
export default function BoardClient({
  clienteId,
  clienteNombre,
}: {
  clienteId: string
  clienteNombre: string
}) {
  const [columnas, setColumnas] = useState<Columna[]>([])
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [loading, setLoading] = useState(true)
  const [boardId, setBoardId] = useState<string | null>(null)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeFicha, setActiveFicha] = useState<Ficha | null>(null)

  const [fichaModal, setFichaModal] = useState<(Partial<Ficha> & { id_columna: string }) | null>(null)
  const [newColName, setNewColName] = useState('')
  const [addingCol, setAddingCol] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/editorial/boards?id_cliente=${clienteId}`)
    if (res.ok) {
      const data = await res.json()
      setBoardId(data.board.id)
      setColumnas(data.columnas)
      setFichas(data.fichas)
    }
    setLoading(false)
  }, [clienteId])

  useEffect(() => { load() }, [load])

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    setActiveId(active.id as string)
    if (active.data.current?.type === 'ficha') {
      setActiveFicha(active.data.current.ficha as Ficha)
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (active.data.current?.type !== 'ficha') return

    const activeFichaData = active.data.current.ficha as Ficha
    const overIsColumna = columnas.find(c => c.id === over.id)

    if (overIsColumna) {
      // Moving over a column header → move to that column
      if (activeFichaData.id_columna !== overIsColumna.id) {
        setFichas(prev =>
          prev.map(f =>
            f.id === activeFichaData.id ? { ...f, id_columna: overIsColumna.id } : f
          )
        )
      }
      return
    }

    const overFicha = fichas.find(f => f.id === over.id)
    if (overFicha && overFicha.id_columna !== activeFichaData.id_columna) {
      setFichas(prev =>
        prev.map(f =>
          f.id === activeFichaData.id ? { ...f, id_columna: overFicha.id_columna } : f
        )
      )
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setActiveFicha(null)

    if (!over || active.id === over.id) return
    if (active.data.current?.type !== 'ficha') return

    const draggedFicha = fichas.find(f => f.id === active.id)
    if (!draggedFicha) return

    // Reorder within same column
    const colFichas = fichas.filter(f => f.id_columna === draggedFicha.id_columna)
    const oldIndex = colFichas.findIndex(f => f.id === active.id)
    const newIndex = colFichas.findIndex(f => f.id === over.id)

    let reordered = colFichas
    if (oldIndex !== -1 && newIndex !== -1) {
      reordered = arrayMove(colFichas, oldIndex, newIndex)
    }

    const reorderedWithOrdenes = reordered.map((f, i) => ({ ...f, orden: i }))
    setFichas(prev => [
      ...prev.filter(f => f.id_columna !== draggedFicha.id_columna),
      ...reorderedWithOrdenes,
    ])

    // Persist to DB
    await Promise.all(
      reorderedWithOrdenes.map(f =>
        fetch(`/api/editorial/fichas?id=${f.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_columna: f.id_columna, orden: f.orden }),
        })
      )
    )
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────
  async function saveFicha(data: Partial<Ficha>) {
    if (!boardId) return
    if (fichaModal?.id) {
      // Update
      const res = await fetch(`/api/editorial/fichas?id=${fichaModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setFichas(prev => prev.map(f => f.id === updated.id ? updated : f))
      }
    } else {
      // Create
      const maxOrden = fichas.filter(f => f.id_columna === data.id_columna).length
      const res = await fetch('/api/editorial/fichas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, id_board: boardId, orden: maxOrden }),
      })
      if (res.ok) {
        const created = await res.json()
        setFichas(prev => [...prev, created])
      }
    }
    setFichaModal(null)
  }

  async function deleteFicha(id: string) {
    if (!confirm('¿Eliminar esta ficha?')) return
    const res = await fetch(`/api/editorial/fichas?id=${id}`, { method: 'DELETE' })
    if (res.ok) setFichas(prev => prev.filter(f => f.id !== id))
  }

  async function addColumna() {
    if (!boardId || !newColName.trim()) return
    const orden = columnas.length
    const COLORS = ['#8b5cf6', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4', '#22c55e', '#f97316', '#ec4899']
    const color = COLORS[orden % COLORS.length]
    const res = await fetch('/api/editorial/columnas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_board: boardId, nombre: newColName.trim(), orden, color }),
    })
    if (res.ok) {
      const col = await res.json()
      setColumnas(prev => [...prev, col])
      setNewColName('')
      setAddingCol(false)
    }
  }

  async function editColumna(c: Columna) {
    const nombre = prompt('Nuevo nombre:', c.nombre)
    if (!nombre || nombre === c.nombre) return
    const res = await fetch(`/api/editorial/columnas?id=${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    })
    if (res.ok) {
      const updated = await res.json()
      setColumnas(prev => prev.map(col => col.id === updated.id ? updated : col))
    }
  }

  async function deleteColumna(id: string) {
    if (!confirm('¿Eliminar columna y todas sus fichas?')) return
    const res = await fetch(`/api/editorial/columnas?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setColumnas(prev => prev.filter(c => c.id !== id))
      setFichas(prev => prev.filter(f => f.id_columna !== id))
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-400">
        <span className="animate-spin text-xl">⏳</span>
        <span>Cargando tablero...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-800 shrink-0">
        <Link href="/editorial" className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Editorial
        </Link>
        <div className="w-px h-4 bg-gray-700" />
        <h1 className="text-white font-semibold">{clienteNombre}</h1>
        <div className="ml-auto">
          {addingCol ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500 w-48"
                placeholder="Nombre de columna"
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addColumna(); if (e.key === 'Escape') setAddingCol(false) }}
              />
              <button onClick={addColumna} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                Añadir
              </button>
              <button onClick={() => setAddingCol(false)} className="text-gray-400 hover:text-white text-sm">
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingCol(true)}
              className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 rounded-lg transition-colors"
            >
              + Nueva columna
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full items-start">
            {columnas.map(col => (
              <ColumnaBoard
                key={col.id}
                columna={col}
                fichas={fichas.filter(f => f.id_columna === col.id).sort((a, b) => a.orden - b.orden)}
                onAddFicha={id_columna => setFichaModal({ id_columna, canal: 'instagram' })}
                onEditFicha={f => setFichaModal(f)}
                onDeleteFicha={deleteFicha}
                onEditColumna={editColumna}
                onDeleteColumna={deleteColumna}
              />
            ))}

            {columnas.length === 0 && (
              <div className="text-gray-500 text-sm italic">
                Sin columnas. Añade una para empezar.
              </div>
            )}
          </div>

          <DragOverlay>
            {activeId && activeFicha && (
              <div className="bg-gray-800 border border-blue-500 rounded-lg p-3 w-72 shadow-2xl rotate-1">
                <p className="text-sm text-white font-medium">{activeFicha.titulo || 'Sin título'}</p>
                <span className="text-xs text-gray-400 mt-1 block">
                  {CANALES[activeFicha.canal]?.emoji} {CANALES[activeFicha.canal]?.label}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Ficha modal */}
      {fichaModal && (
        <FichaModal
          ficha={fichaModal}
          columnas={columnas}
          onSave={saveFicha}
          onClose={() => setFichaModal(null)}
        />
      )}
    </div>
  )
}
