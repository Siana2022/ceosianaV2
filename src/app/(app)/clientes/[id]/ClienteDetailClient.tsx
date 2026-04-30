'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface Empleado { id: string; nombre: string }
interface Departamento { id: string; nombre: string }

interface Servicio {
  id: string
  nombre: string
  tipo: 'recurrente' | 'oneshot'
  precio_base: number | null
  activo: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
  notas: string | null
  departamento: { id: string; nombre: string } | null
  responsable: { id: string; nombre: string } | null
}

interface Captacion {
  id: string
  id_captador: string | null
  id_mantenedor: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  captador: { id: string; nombre: string } | null
  mantenedor: { id: string; nombre: string } | null
}

interface Ingreso {
  id: string
  concepto: string
  valor: number
  mes: number
  anio: number
  id_servicio: string | null
  id_departamento: string | null
  id_responsable: string | null
  notas: string | null
}

interface Cliente {
  id: string
  nombre: string
  activo: boolean
  fecha_alta: string | null
  notas: string | null
}

interface Props {
  cliente: Cliente
  servicios: Servicio[]
  captacion: Captacion | null
  ingresos: Ingreso[]
  empleados: Empleado[]
  departamentos: Departamento[]
  mrr: number
  total_facturado: number
  year: number
}

// Check if a service should be considered active in a given month/year
function isServiceActiveInMonth(s: Servicio, mes: number, year: number): boolean {
  const monthStr = `${year}-${String(mes).padStart(2, '0')}`
  if (s.fecha_inicio) {
    const start = s.fecha_inicio.substring(0, 7)
    if (monthStr < start) return false
  }
  if (s.fecha_fin) {
    const end = s.fecha_fin.substring(0, 7)
    if (monthStr > end) return false
  }
  return true
}

export default function ClienteDetailClient({
  cliente,
  servicios,
  captacion,
  ingresos,
  empleados,
  departamentos,
  mrr,
  total_facturado,
  year,
}: Props) {
  const router = useRouter()

  // Build ingreso map keyed by `${id_servicio}_${mes}`
  const [ingresoMap, setIngresoMap] = useState<Map<string, Ingreso>>(() => {
    const m = new Map<string, Ingreso>()
    for (const ing of ingresos) {
      if (ing.id_servicio) m.set(`${ing.id_servicio}_${ing.mes}`, ing)
    }
    return m
  })

  // Cell editing
  const [editingCell, setEditingCell] = useState<{ servicioId: string; mes: number } | null>(null)
  const [cellValue, setCellValue] = useState('')
  const cellInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus()
      cellInputRef.current.select()
    }
  }, [editingCell])

  const openCell = (s: Servicio, mes: number) => {
    const key = `${s.id}_${mes}`
    const existing = ingresoMap.get(key)
    setEditingCell({ servicioId: s.id, mes })
    setCellValue(existing ? String(existing.valor) : '')
  }

  const saveCell = async (s: Servicio, mes: number) => {
    const key = `${s.id}_${mes}`
    const existing = ingresoMap.get(key)
    const valor = parseFloat(cellValue)
    const isEmpty = cellValue.trim() === '' || isNaN(valor)

    setEditingCell(null)

    if (isEmpty && !existing) return // nothing to do

    if (isEmpty && existing) {
      // DELETE
      await fetch(`/api/ingresos?id=${existing.id}`, { method: 'DELETE' })
      setIngresoMap(prev => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
      return
    }

    if (!isEmpty && valor === 0 && existing) {
      // DELETE if setting to 0
      await fetch(`/api/ingresos?id=${existing.id}`, { method: 'DELETE' })
      setIngresoMap(prev => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
      return
    }

    if (!isEmpty && valor > 0) {
      if (existing) {
        // PUT
        const res = await fetch('/api/ingresos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existing.id, valor, concepto: s.nombre }),
        })
        if (res.ok) {
          const updated = await res.json()
          setIngresoMap(prev => {
            const next = new Map(prev)
            next.set(key, { ...existing, valor: updated.valor })
            return next
          })
        }
      } else {
        // POST
        const res = await fetch('/api/ingresos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_cliente: cliente.id,
            id_servicio: s.id,
            concepto: s.nombre,
            valor,
            mes,
            anio: year,
            id_departamento: s.departamento?.id ?? null,
            id_responsable: s.responsable?.id ?? null,
          }),
        })
        if (res.ok) {
          const [created] = await res.json()
          if (created) {
            setIngresoMap(prev => {
              const next = new Map(prev)
              next.set(key, {
                id: created.id,
                concepto: created.concepto,
                valor: created.valor,
                mes: created.mes,
                anio: created.anio,
                id_servicio: created.id_servicio,
                id_departamento: created.id_departamento,
                id_responsable: created.id_responsable,
                notas: created.notas,
              })
              return next
            })
          }
        }
      }
    }
  }

  // Edit cliente modal
  const [showEditCliente, setShowEditCliente] = useState(false)
  const [clienteForm, setClienteForm] = useState({
    nombre: cliente.nombre,
    fecha_alta: cliente.fecha_alta ?? '',
    notas: cliente.notas ?? '',
  })

  // Servicio modal
  const [showServicioModal, setShowServicioModal] = useState(false)
  const [servicioMode, setServicioMode] = useState<'create' | 'edit'>('create')
  const [editServicioId, setEditServicioId] = useState<string | null>(null)
  const [servicioForm, setServicioForm] = useState({
    nombre: '', tipo: 'recurrente' as 'recurrente' | 'oneshot',
    precio_base: '', id_departamento: '', id_responsable: '', fecha_inicio: '', fecha_fin: '', notas: '',
  })

  // Captacion modal
  const [showCaptacionModal, setShowCaptacionModal] = useState(false)
  const [captacionForm, setCaptacionForm] = useState({
    id_captador: captacion?.id_captador ?? '',
    id_mantenedor: captacion?.id_mantenedor ?? '',
    fecha_inicio: captacion?.fecha_inicio ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // --- Cliente ---
  const saveCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteForm.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/clientes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cliente.id, nombre: clienteForm.nombre, fecha_alta: clienteForm.fecha_alta, notas: clienteForm.notas }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      setShowEditCliente(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  // --- Servicio ---
  const openCreateServicio = () => {
    setServicioMode('create')
    setEditServicioId(null)
    setServicioForm({ nombre: '', tipo: 'recurrente', precio_base: '', id_departamento: '', id_responsable: '', fecha_inicio: '', fecha_fin: '', notas: '' })
    setError('')
    setShowServicioModal(true)
  }

  const openEditServicio = (s: Servicio) => {
    setServicioMode('edit')
    setEditServicioId(s.id)
    setServicioForm({
      nombre: s.nombre,
      tipo: s.tipo,
      precio_base: s.precio_base?.toString() ?? '',
      id_departamento: s.departamento?.id ?? '',
      id_responsable: s.responsable?.id ?? '',
      fecha_inicio: s.fecha_inicio ?? '',
      fecha_fin: s.fecha_fin ?? '',
      notas: s.notas ?? '',
    })
    setError('')
    setShowServicioModal(true)
  }

  const saveServicio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!servicioForm.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const base = {
        nombre: servicioForm.nombre,
        tipo: servicioForm.tipo,
        precio_base: servicioForm.precio_base ? parseFloat(servicioForm.precio_base) : null,
        id_departamento: servicioForm.id_departamento || null,
        id_responsable: servicioForm.id_responsable || null,
        fecha_inicio: servicioForm.fecha_inicio || null,
        fecha_fin: servicioForm.fecha_fin || null,
        notas: servicioForm.notas || null,
      }
      const body = servicioMode === 'create'
        ? { id_cliente: cliente.id, ...base }
        : { id: editServicioId, ...base }

      const res = await fetch('/api/servicios', {
        method: servicioMode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      setShowServicioModal(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  const toggleServicioActivo = async (s: Servicio) => {
    await fetch('/api/servicios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, activo: !s.activo }),
    })
    router.refresh()
  }

  // --- Captacion ---
  const saveCaptacion = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const method = captacion ? 'PUT' : 'POST'
      const body = captacion
        ? { id: captacion.id, id_captador: captacionForm.id_captador || null, id_mantenedor: captacionForm.id_mantenedor || null, fecha_inicio: captacionForm.fecha_inicio || null }
        : { id_cliente: cliente.id, id_captador: captacionForm.id_captador || null, id_mantenedor: captacionForm.id_mantenedor || null, fecha_inicio: captacionForm.fecha_inicio || null }

      const res = await fetch('/api/captacion', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      setShowCaptacionModal(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  // Compute totals
  const monthTotals = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    return servicios.reduce((sum, s) => {
      const ing = ingresoMap.get(`${s.id}_${mes}`)
      return sum + (ing ? Number(ing.valor) : 0)
    }, 0)
  })

  const servicioTotals = servicios.map(s =>
    Array.from({ length: 12 }, (_, i) => ingresoMap.get(`${s.id}_${i + 1}`))
      .reduce((sum, ing) => sum + (ing ? Number(ing.valor) : 0), 0)
  )

  const grandTotal = monthTotals.reduce((a, b) => a + b, 0)

  const numActivos = servicios.filter(s => s.activo).length
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors text-sm">← Volver</button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{cliente.nombre}</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                cliente.activo ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'
              }`}>
                {cliente.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            {cliente.fecha_alta && (
              <p className="text-gray-500 text-sm mt-0.5">Alta: {cliente.fecha_alta}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => { setShowEditCliente(true); setError('') }}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Editar cliente
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">MRR</p>
          <p className={`text-2xl font-bold mt-1 ${mrr > 0 ? 'text-green-400' : 'text-gray-500'}`}>{fmt(mrr)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Facturado {year}</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(grandTotal)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Servicios activos</p>
          <p className="text-2xl font-bold text-white mt-1">{numActivos}</p>
          <p className="text-gray-500 text-xs mt-0.5">{servicios.length} en total</p>
        </div>
      </div>

      {/* Notas */}
      {cliente.notas && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm mb-1">Notas</p>
          <p className="text-gray-300 text-sm whitespace-pre-line">{cliente.notas}</p>
        </div>
      )}

      {/* Matriz anual de facturación */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-wrap gap-3">
          <div>
            <h3 className="text-white font-semibold">Facturación por servicio y mes</h3>
            <p className="text-gray-500 text-xs mt-0.5">Haz clic en cualquier celda para editar</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Year selector */}
            {years.map(y => (
              <a
                key={y}
                href={`?year=${y}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  y === year ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {y}
              </a>
            ))}
            <button
              onClick={openCreateServicio}
              className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              + Servicio
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left text-gray-400 font-medium py-2.5 px-4 min-w-[180px] sticky left-0 bg-gray-800/50 z-10">Servicio</th>
                {MESES_CORTO.map(m => (
                  <th key={m} className="text-center text-gray-400 font-medium py-2.5 px-2 min-w-[72px]">{m}</th>
                ))}
                <th className="text-right text-gray-400 font-medium py-2.5 px-4 min-w-[80px]">Total</th>
                <th className="text-right text-gray-400 font-medium py-2.5 px-4 min-w-[80px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {servicios.length === 0 && (
                <tr>
                  <td colSpan={15} className="text-center text-gray-500 py-10">
                    Sin servicios. Añade el primero.
                  </td>
                </tr>
              )}
              {servicios.map((s, idx) => (
                <tr
                  key={s.id}
                  className={`border-b border-gray-800/50 ${s.activo ? 'hover:bg-gray-800/20' : 'opacity-50'}`}
                >
                  {/* Service name - sticky */}
                  <td className="py-2 px-4 sticky left-0 bg-gray-900 z-10 border-r border-gray-800/50">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.activo ? 'bg-green-400' : 'bg-gray-600'}`} />
                      <span className="text-white font-medium truncate max-w-[140px]" title={s.nombre}>{s.nombre}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 ml-3.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${s.tipo === 'recurrente' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                        {s.tipo === 'recurrente' ? 'REC' : 'ONE'}
                      </span>
                      {s.precio_base && <span className="text-gray-500">{fmt(s.precio_base)}/mes</span>}
                    </div>
                  </td>

                  {/* Month cells */}
                  {Array.from({ length: 12 }, (_, i) => {
                    const mes = i + 1
                    const key = `${s.id}_${mes}`
                    const ing = ingresoMap.get(key)
                    const active = isServiceActiveInMonth(s, mes, year)
                    const isEditing = editingCell?.servicioId === s.id && editingCell?.mes === mes

                    return (
                      <td key={mes} className="py-1.5 px-1 text-center">
                        {isEditing ? (
                          <input
                            ref={cellInputRef}
                            type="number"
                            value={cellValue}
                            onChange={e => setCellValue(e.target.value)}
                            onBlur={() => saveCell(s, mes)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.currentTarget.blur() }
                              if (e.key === 'Escape') { setEditingCell(null) }
                              if (e.key === 'Tab') {
                                e.preventDefault()
                                saveCell(s, mes)
                                // Move to next month
                                const nextMes = mes < 12 ? mes + 1 : null
                                if (nextMes) setTimeout(() => openCell(s, nextMes), 50)
                              }
                            }}
                            className="w-16 bg-blue-900/40 border border-blue-500 rounded text-center text-white text-xs px-1 py-1 focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => active && openCell(s, mes)}
                            className={`w-full min-w-[64px] py-1 px-1 rounded transition-colors text-center ${
                              !active
                                ? 'cursor-default'
                                : ing && Number(ing.valor) > 0
                                  ? 'hover:bg-green-900/30 cursor-pointer'
                                  : 'hover:bg-gray-800/60 cursor-pointer'
                            }`}
                            disabled={!active}
                          >
                            {!active ? (
                              <span className="text-gray-700">·</span>
                            ) : ing && Number(ing.valor) > 0 ? (
                              <span className="text-green-400 font-medium">{fmt(Number(ing.valor))}</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </button>
                        )}
                      </td>
                    )
                  })}

                  {/* Row total */}
                  <td className="py-2 px-4 text-right">
                    <span className={`font-medium ${servicioTotals[idx] > 0 ? 'text-white' : 'text-gray-600'}`}>
                      {servicioTotals[idx] > 0 ? fmt(servicioTotals[idx]) : '—'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-2 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditServicio(s)} className="text-gray-500 hover:text-white px-1.5 py-1 rounded hover:bg-gray-700 transition-colors">✏️</button>
                      <button onClick={() => toggleServicioActivo(s)} className={`px-1.5 py-1 rounded hover:bg-gray-700 transition-colors text-[10px] ${s.activo ? 'text-gray-500 hover:text-red-400' : 'text-gray-600 hover:text-green-400'}`}>
                        {s.activo ? 'OFF' : 'ON'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Totals row */}
              {servicios.length > 0 && (
                <tr className="border-t border-gray-700 bg-gray-800/30">
                  <td className="py-3 px-4 sticky left-0 bg-gray-800/30 z-10 border-r border-gray-800/50">
                    <span className="text-gray-400 font-semibold text-xs uppercase tracking-wide">Total</span>
                  </td>
                  {monthTotals.map((total, i) => (
                    <td key={i} className="py-3 px-2 text-center">
                      <span className={`font-semibold ${total > 0 ? 'text-white' : 'text-gray-600'}`}>
                        {total > 0 ? fmt(total) : '—'}
                      </span>
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right">
                    <span className="text-white font-bold">{fmt(grandTotal)}</span>
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Captacion */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Captación</h3>
          <button
            onClick={() => {
              setCaptacionForm({ id_captador: captacion?.id_captador ?? '', id_mantenedor: captacion?.id_mantenedor ?? '', fecha_inicio: captacion?.fecha_inicio ?? '' })
              setError('')
              setShowCaptacionModal(true)
            }}
            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            {captacion ? 'Editar' : 'Asignar'}
          </button>
        </div>
        {captacion ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-500 text-xs mb-1">Captador</p>
              <p className="text-white">{captacion.captador?.nombre ?? <span className="text-gray-600">No asignado</span>}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Mantenedor</p>
              <p className="text-white">{captacion.mantenedor?.nombre ?? <span className="text-gray-600">No asignado</span>}</p>
            </div>
            {captacion.fecha_inicio && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Fecha inicio</p>
                <p className="text-gray-300">{captacion.fecha_inicio}</p>
              </div>
            )}
            {captacion.fecha_fin && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Fecha fin</p>
                <p className="text-red-400">{captacion.fecha_fin}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Sin captación asignada.</p>
        )}
      </div>

      {/* Modal: Edit cliente */}
      {showEditCliente && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">Editar cliente</h3>
              <button onClick={() => setShowEditCliente(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={saveCliente}>
              <div className="p-6 space-y-4">
                {error && <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm">{error}</div>}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Nombre *</label>
                  <input type="text" value={clienteForm.nombre} onChange={e => setClienteForm(f => ({ ...f, nombre: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Fecha de alta</label>
                  <input type="date" value={clienteForm.fecha_alta} onChange={e => setClienteForm(f => ({ ...f, fecha_alta: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Notas</label>
                  <textarea value={clienteForm.notas} onChange={e => setClienteForm(f => ({ ...f, notas: e.target.value }))} rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
                <button type="button" onClick={() => setShowEditCliente(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Servicio */}
      {showServicioModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
              <h3 className="text-white font-semibold">{servicioMode === 'create' ? 'Añadir servicio' : 'Editar servicio'}</h3>
              <button onClick={() => setShowServicioModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={saveServicio}>
              <div className="p-6 space-y-4">
                {error && <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm">{error}</div>}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Nombre *</label>
                  <input type="text" value={servicioForm.nombre} onChange={e => setServicioForm(f => ({ ...f, nombre: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Tipo</label>
                    <select value={servicioForm.tipo} onChange={e => setServicioForm(f => ({ ...f, tipo: e.target.value as 'recurrente' | 'oneshot' }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      <option value="recurrente">Recurrente</option>
                      <option value="oneshot">Oneshot</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Precio base (€)</label>
                    <input type="number" min="0" step="0.01" value={servicioForm.precio_base} onChange={e => setServicioForm(f => ({ ...f, precio_base: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Departamento</label>
                  <select value={servicioForm.id_departamento} onChange={e => setServicioForm(f => ({ ...f, id_departamento: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sin departamento</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Responsable</label>
                  <select value={servicioForm.id_responsable} onChange={e => setServicioForm(f => ({ ...f, id_responsable: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sin responsable</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Fecha inicio</label>
                    <input type="date" value={servicioForm.fecha_inicio} onChange={e => setServicioForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Fecha fin</label>
                    <input type="date" value={servicioForm.fecha_fin} onChange={e => setServicioForm(f => ({ ...f, fecha_fin: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Notas</label>
                  <textarea value={servicioForm.notas} onChange={e => setServicioForm(f => ({ ...f, notas: e.target.value }))} rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
                <button type="button" onClick={() => setShowServicioModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Guardando...' : servicioMode === 'create' ? 'Añadir' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Captacion */}
      {showCaptacionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">{captacion ? 'Editar captación' : 'Asignar captación'}</h3>
              <button onClick={() => setShowCaptacionModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={saveCaptacion}>
              <div className="p-6 space-y-4">
                {error && <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm">{error}</div>}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Captador</label>
                  <select value={captacionForm.id_captador} onChange={e => setCaptacionForm(f => ({ ...f, id_captador: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sin captador</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Mantenedor</label>
                  <select value={captacionForm.id_mantenedor} onChange={e => setCaptacionForm(f => ({ ...f, id_mantenedor: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sin mantenedor</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Fecha inicio</label>
                  <input type="date" value={captacionForm.fecha_inicio} onChange={e => setCaptacionForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
                <button type="button" onClick={() => setShowCaptacionModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
