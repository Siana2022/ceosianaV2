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
  tipo_servicio: { id: string; nombre: string } | null
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

interface Gasto {
  id: string
  concepto: string
  valor: number
  mes: number
  anio: number
  tipo: string
}

interface ResponsableData {
  id_servicio: string
  id_empleado: string
  nombre: string
  mes: number
  anio: number
  porcentaje: number
}

interface TipoServicio { id: string; nombre: string }

interface Props {
  cliente: Cliente
  servicios: Servicio[]
  captacion: Captacion | null
  ingresos: Ingreso[]
  gastos: Gasto[]
  empleados: Empleado[]
  departamentos: Departamento[]
  responsablesIniciales: ResponsableData[]
  empleadosPorDepartamento: Record<string, { id: string; nombre: string }[]>
  tiposServicio: TipoServicio[]
  mrr: number
  total_facturado: number
  total_costes: number
  year: number
}

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

// Get initials from name
function initials(nombre: string) {
  return nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

export default function ClienteDetailClient({
  cliente,
  servicios,
  captacion,
  ingresos,
  gastos,
  empleados,
  departamentos,
  responsablesIniciales,
  empleadosPorDepartamento,
  tiposServicio,
  mrr,
  total_facturado,
  total_costes,
  year,
}: Props) {
  const router = useRouter()

  // ── Ingreso map ──────────────────────────────────────────────────────
  const [ingresoMap, setIngresoMap] = useState<Map<string, Ingreso>>(() => {
    const m = new Map<string, Ingreso>()
    for (const ing of ingresos) {
      if (ing.id_servicio) m.set(`${ing.id_servicio}_${ing.mes}`, ing)
    }
    return m
  })

  // ── Responsables map: key = `${id_servicio}_${mes}` ──────────────────
  const [responsablesMap, setResponsablesMap] = useState<
    Map<string, { id_empleado: string; nombre: string; porcentaje: number }[]>
  >(() => {
    const m = new Map<string, { id_empleado: string; nombre: string; porcentaje: number }[]>()
    for (const r of responsablesIniciales) {
      const key = `${r.id_servicio}_${r.mes}`
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push({ id_empleado: r.id_empleado, nombre: r.nombre, porcentaje: r.porcentaje })
    }
    return m
  })

  // ── Billing cell editing ─────────────────────────────────────────────
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
    if (isEmpty && !existing) return
    if ((isEmpty || valor === 0) && existing) {
      await fetch(`/api/ingresos?id=${existing.id}`, { method: 'DELETE' })
      setIngresoMap(prev => { const next = new Map(prev); next.delete(key); return next })
      return
    }
    if (!isEmpty && valor > 0) {
      if (existing) {
        const res = await fetch('/api/ingresos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existing.id, valor, concepto: s.tipo_servicio?.nombre ?? s.nombre }),
        })
        if (res.ok) {
          const updated = await res.json()
          setIngresoMap(prev => { const next = new Map(prev); next.set(key, { ...existing, valor: updated.valor }); return next })
        }
      } else {
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
              next.set(key, { id: created.id, concepto: created.concepto, valor: created.valor, mes: created.mes, anio: created.anio, id_servicio: created.id_servicio, id_departamento: created.id_departamento, id_responsable: created.id_responsable, notas: created.notas })
              return next
            })
          }
        }
      }
    }
  }

  // ── Responsables modal ───────────────────────────────────────────────
  // Which service is open in the responsables panel
  const [respServicio, setRespServicio] = useState<Servicio | null>(null)
  // Which month is selected inside the panel
  const [respMes, setRespMes] = useState(1)
  // Edit state per employee: [{id, nombre, porcentaje, checked}]
  const [respEdit, setRespEdit] = useState<
    { id: string; nombre: string; porcentaje: number; checked: boolean }[]
  >([])
  const [savingResp, setSavingResp] = useState(false)

  const openRespModal = (s: Servicio) => {
    setRespServicio(s)
    const defaultMes = new Date().getMonth() + 1
    setRespMes(defaultMes)
    loadRespEdit(s, defaultMes)
  }

  const loadRespEdit = (s: Servicio, mes: number) => {
    const key = `${s.id}_${mes}`
    const current = responsablesMap.get(key) ?? []
    // Available employees: those in the service's department, or all employees
    const available =
      s.departamento?.id && empleadosPorDepartamento[s.departamento.id]?.length
        ? empleadosPorDepartamento[s.departamento.id]
        : empleados

    setRespEdit(
      available.map(emp => {
        const existing = current.find(r => r.id_empleado === emp.id)
        return {
          id: emp.id,
          nombre: emp.nombre,
          porcentaje: existing?.porcentaje ?? 100,
          checked: !!existing,
        }
      })
    )
  }

  const switchRespMes = (s: Servicio, mes: number) => {
    setRespMes(mes)
    loadRespEdit(s, mes)
  }

  const totalPct = respEdit.filter(e => e.checked).reduce((s, e) => s + e.porcentaje, 0)

  const saveResp = async () => {
    if (!respServicio) return
    setSavingResp(true)
    const asignaciones = respEdit
      .filter(e => e.checked)
      .map(e => ({ id_empleado: e.id, porcentaje: e.porcentaje }))

    const res = await fetch('/api/servicio-responsables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_servicio: respServicio.id, mes: respMes, anio: year, asignaciones }),
    })

    if (res.ok) {
      const key = `${respServicio.id}_${respMes}`
      const saved = asignaciones.map(a => ({
        id_empleado: a.id_empleado,
        nombre: respEdit.find(e => e.id === a.id_empleado)?.nombre ?? '',
        porcentaje: a.porcentaje,
      }))
      setResponsablesMap(prev => {
        const next = new Map(prev)
        if (saved.length === 0) next.delete(key)
        else next.set(key, saved)
        return next
      })
    }
    setSavingResp(false)
  }

  const copyForward = async () => {
    if (!respServicio) return
    setSavingResp(true)
    const asignaciones = respEdit
      .filter(e => e.checked)
      .map(e => ({ id_empleado: e.id, porcentaje: e.porcentaje }))

    const promises = []
    for (let m = respMes; m <= 12; m++) {
      promises.push(
        fetch('/api/servicio-responsables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_servicio: respServicio.id, mes: m, anio: year, asignaciones }),
        })
      )
    }
    await Promise.all(promises)

    // Update local state
    setResponsablesMap(prev => {
      const next = new Map(prev)
      const saved = asignaciones.map(a => ({
        id_empleado: a.id_empleado,
        nombre: respEdit.find(e => e.id === a.id_empleado)?.nombre ?? '',
        porcentaje: a.porcentaje,
      }))
      for (let m = respMes; m <= 12; m++) {
        const key = `${respServicio.id}_${m}`
        if (saved.length === 0) next.delete(key)
        else next.set(key, saved)
      }
      return next
    })
    setSavingResp(false)
  }

  // ── Other modals ─────────────────────────────────────────────────────
  const [showEditCliente, setShowEditCliente] = useState(false)
  const [clienteForm, setClienteForm] = useState({
    nombre: cliente.nombre,
    fecha_alta: cliente.fecha_alta ?? '',
    notas: cliente.notas ?? '',
  })

  const [showServicioModal, setShowServicioModal] = useState(false)
  const [servicioMode, setServicioMode] = useState<'create' | 'edit'>('create')
  const [editServicioId, setEditServicioId] = useState<string | null>(null)
  const [servicioForm, setServicioForm] = useState({
    id_tipo_servicio: '', tipo: 'recurrente' as 'recurrente' | 'oneshot',
    precio_base: '', id_departamento: '', fecha_inicio: '', fecha_fin: '', notas: '',
  })
  const [servicioResponsables, setServicioResponsables] = useState<string[]>([])

  const [showCaptacionModal, setShowCaptacionModal] = useState(false)
  const [captacionForm, setCaptacionForm] = useState({
    id_captador: captacion?.id_captador ?? '',
    id_mantenedor: captacion?.id_mantenedor ?? '',
    fecha_inicio: captacion?.fecha_inicio ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Handlers ─────────────────────────────────────────────────────────
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

  const openCreateServicio = () => {
    setServicioMode('create'); setEditServicioId(null)
    setServicioForm({ id_tipo_servicio: '', tipo: 'recurrente', precio_base: '', id_departamento: '', fecha_inicio: '', fecha_fin: '', notas: '' })
    setServicioResponsables([])
    setError(''); setShowServicioModal(true)
  }

  const openEditServicio = (s: Servicio) => {
    setServicioMode('edit'); setEditServicioId(s.id)
    setServicioForm({
      id_tipo_servicio: s.tipo_servicio?.id ?? '',
      tipo: s.tipo,
      precio_base: s.precio_base?.toString() ?? '',
      id_departamento: s.departamento?.id ?? '',
      fecha_inicio: s.fecha_inicio ?? '',
      fecha_fin: s.fecha_fin ?? '',
      notas: s.notas ?? '',
    })
    setServicioResponsables([])
    setError(''); setShowServicioModal(true)
  }

  const saveServicio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (servicioMode === 'create' && !servicioForm.id_tipo_servicio) { setError('Selecciona un tipo de servicio'); return }
    setSaving(true); setError('')
    try {
      const tipoNombre = tiposServicio.find(t => t.id === servicioForm.id_tipo_servicio)?.nombre ?? ''
      const base = {
        nombre: tipoNombre || (editServicioId ? undefined : ''),
        id_tipo_servicio: servicioForm.id_tipo_servicio || null,
        tipo: servicioForm.tipo,
        precio_base: servicioForm.precio_base ? parseFloat(servicioForm.precio_base) : null,
        id_departamento: servicioForm.id_departamento || null,
        fecha_inicio: servicioForm.fecha_inicio || null,
        fecha_fin: servicioForm.fecha_fin || null,
        notas: servicioForm.notas || null,
      }
      const body = servicioMode === 'create' ? { id_cliente: cliente.id, ...base } : { id: editServicioId, ...base }
      const res = await fetch('/api/servicios', { method: servicioMode === 'create' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      const saved = await res.json()
      // Save base responsables if any selected
      if (servicioResponsables.length > 0) {
        await fetch('/api/servicio-responsables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_servicio: saved.id ?? editServicioId, mes: 0, anio: 0,
            asignaciones: servicioResponsables.map(id => ({ id_empleado: id, porcentaje: Math.round(100 / servicioResponsables.length) })),
          }),
        })
      }
      setShowServicioModal(false); router.refresh()
    } finally { setSaving(false) }
  }

  const toggleServicioActivo = async (s: Servicio) => {
    await fetch('/api/servicios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, activo: !s.activo }) })
    router.refresh()
  }

  const saveCaptacion = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const method = captacion ? 'PUT' : 'POST'
      const body = captacion
        ? { id: captacion.id, id_captador: captacionForm.id_captador || null, id_mantenedor: captacionForm.id_mantenedor || null, fecha_inicio: captacionForm.fecha_inicio || null }
        : { id_cliente: cliente.id, id_captador: captacionForm.id_captador || null, id_mantenedor: captacionForm.id_mantenedor || null, fecha_inicio: captacionForm.fecha_inicio || null }
      const res = await fetch('/api/captacion', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      setShowCaptacionModal(false); router.refresh()
    } finally { setSaving(false) }
  }

  // ── Totals ────────────────────────────────────────────────────────────
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
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors text-sm">← Volver</button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{cliente.nombre}</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cliente.activo ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                {cliente.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            {cliente.fecha_alta && <p className="text-gray-500 text-sm mt-0.5">Alta: {cliente.fecha_alta}</p>}
          </div>
        </div>
        <button onClick={() => { setShowEditCliente(true); setError('') }} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Editar cliente
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">MRR</p>
          <p className={`text-2xl font-bold mt-1 ${mrr > 0 ? 'text-green-400' : 'text-gray-500'}`}>{fmt(mrr)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Facturado {year}</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(grandTotal)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Costes imputados {year}</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{fmt(total_costes)}</p>
          <p className="text-gray-500 text-xs mt-0.5">{gastos.length} gastos</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Margen {year}</p>
          {(() => {
            const margen = grandTotal - total_costes
            const pct = grandTotal > 0 ? (margen / grandTotal) * 100 : 0
            return (
              <>
                <p className={`text-2xl font-bold mt-1 ${margen >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(margen)}</p>
                <p className="text-gray-500 text-xs mt-0.5">{pct.toFixed(1)}% sobre facturado</p>
              </>
            )
          })()}
        </div>
      </div>

      {/* Notas */}
      {cliente.notas && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm mb-1">Notas</p>
          <p className="text-gray-300 text-sm whitespace-pre-line">{cliente.notas}</p>
        </div>
      )}

      {/* Billing matrix */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-wrap gap-3">
          <div>
            <h3 className="text-white font-semibold">Facturación por servicio y mes</h3>
            <p className="text-gray-500 text-xs mt-0.5">Clic en celda para editar · 👥 para gestionar responsables</p>
          </div>
          <div className="flex items-center gap-2">
            {years.map(y => (
              <a key={y} href={`?year=${y}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${y === year ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>{y}</a>
            ))}
            <button onClick={openCreateServicio} className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
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
                <tr><td colSpan={15} className="text-center text-gray-500 py-10">Sin servicios. Añade el primero.</td></tr>
              )}
              {servicios.map((s, idx) => (
                <>
                  {/* Billing row */}
                  <tr key={s.id} className={`border-b border-gray-800/30 ${s.activo ? 'hover:bg-gray-800/20' : 'opacity-50'}`}>
                    <td className="py-2 px-4 sticky left-0 bg-gray-900 z-10 border-r border-gray-800/50">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.activo ? 'bg-green-400' : 'bg-gray-600'}`} />
                        <span className="text-white font-medium truncate max-w-[140px]" title={s.tipo_servicio?.nombre ?? s.nombre}>{s.tipo_servicio?.nombre ?? s.nombre}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 ml-3.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${s.tipo === 'recurrente' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                          {s.tipo === 'recurrente' ? 'REC' : 'ONE'}
                        </span>
                        {s.precio_base && <span className="text-gray-500">{fmt(s.precio_base)}/mes</span>}
                      </div>
                    </td>

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
                                if (e.key === 'Enter') e.currentTarget.blur()
                                if (e.key === 'Escape') setEditingCell(null)
                                if (e.key === 'Tab') {
                                  e.preventDefault()
                                  saveCell(s, mes)
                                  const nextMes = mes < 12 ? mes + 1 : null
                                  if (nextMes) setTimeout(() => openCell(s, nextMes), 50)
                                }
                              }}
                              className="w-16 bg-blue-900/40 border border-blue-500 rounded text-center text-white text-xs px-1 py-1 focus:outline-none"
                            />
                          ) : (
                            <button
                              onClick={() => active && openCell(s, mes)}
                              disabled={!active}
                              className={`w-full min-w-[64px] py-1 px-1 rounded transition-colors text-center ${
                                !active ? 'cursor-default' :
                                ing && Number(ing.valor) > 0 ? 'hover:bg-green-900/30 cursor-pointer' :
                                'hover:bg-gray-800/60 cursor-pointer'
                              }`}
                            >
                              {!active ? <span className="text-gray-700">·</span>
                                : ing && Number(ing.valor) > 0 ? <span className="text-green-400 font-medium">{fmt(Number(ing.valor))}</span>
                                : <span className="text-gray-600">—</span>}
                            </button>
                          )}
                        </td>
                      )
                    })}

                    <td className="py-2 px-4 text-right">
                      <span className={`font-medium ${servicioTotals[idx] > 0 ? 'text-white' : 'text-gray-600'}`}>
                        {servicioTotals[idx] > 0 ? fmt(servicioTotals[idx]) : '—'}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openRespModal(s)}
                          title="Gestionar responsables"
                          className="text-gray-500 hover:text-purple-400 px-1.5 py-1 rounded hover:bg-gray-700 transition-colors text-sm"
                        >
                          👥
                        </button>
                        <button onClick={() => openEditServicio(s)} className="text-gray-500 hover:text-white px-1.5 py-1 rounded hover:bg-gray-700 transition-colors">✏️</button>
                        <button onClick={() => toggleServicioActivo(s)} className={`px-1.5 py-1 rounded hover:bg-gray-700 transition-colors text-[10px] ${s.activo ? 'text-gray-500 hover:text-red-400' : 'text-gray-600 hover:text-green-400'}`}>
                          {s.activo ? 'OFF' : 'ON'}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Responsables sub-row */}
                  <tr key={`resp-${s.id}`} className="border-b border-gray-800/50 bg-gray-800/10">
                    <td className="py-1 px-4 sticky left-0 bg-gray-800/10 z-10 border-r border-gray-800/50">
                      <span className="text-gray-600 text-[10px] uppercase tracking-wide">Responsables</span>
                    </td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const mes = i + 1
                      const key = `${s.id}_${mes}`
                      const resps = responsablesMap.get(key) ?? []
                      return (
                        <td key={mes} className="py-1 px-1 text-center">
                          {resps.length > 0 ? (
                            <div className="flex flex-wrap justify-center gap-0.5">
                              {resps.map(r => (
                                <span
                                  key={r.id_empleado}
                                  title={`${r.nombre} (${r.porcentaje}%)`}
                                  className="w-5 h-5 rounded-full bg-purple-800/60 border border-purple-700/40 text-purple-200 text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                                >
                                  {initials(r.nombre)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-800 text-[10px]">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td />
                    <td />
                  </tr>
                </>
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
                  <td className="py-3 px-4 text-right"><span className="text-white font-bold">{fmt(grandTotal)}</span></td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Costes imputados */}
      {gastos.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Costes imputados {year}</h3>
            <p className="text-gray-500 text-xs mt-0.5">Gastos de la agencia asignados a este cliente</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-6 py-3">Concepto</th>
                <th className="text-left px-4 py-3">Mes</th>
                <th className="text-right px-6 py-3">Valor</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map(g => (
                <tr key={g.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-6 py-3 text-white">{g.concepto}</td>
                  <td className="px-4 py-3 text-gray-400">{MESES_CORTO[g.mes - 1]}</td>
                  <td className="px-6 py-3 text-right text-red-400 font-medium">{fmt(Number(g.valor))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-800/30">
                <td colSpan={2} className="px-6 py-3 text-gray-400 text-sm font-medium">Total costes</td>
                <td className="px-6 py-3 text-right text-white font-bold">{fmt(total_costes)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Captacion */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Captación</h3>
          <button onClick={() => { setCaptacionForm({ id_captador: captacion?.id_captador ?? '', id_mantenedor: captacion?.id_mantenedor ?? '', fecha_inicio: captacion?.fecha_inicio ?? '' }); setError(''); setShowCaptacionModal(true) }}
            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            {captacion ? 'Editar' : 'Asignar'}
          </button>
        </div>
        {captacion ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><p className="text-gray-500 text-xs mb-1">Captador</p><p className="text-white">{captacion.captador?.nombre ?? <span className="text-gray-600">No asignado</span>}</p></div>
            <div><p className="text-gray-500 text-xs mb-1">Mantenedor</p><p className="text-white">{captacion.mantenedor?.nombre ?? <span className="text-gray-600">No asignado</span>}</p></div>
            {captacion.fecha_inicio && <div><p className="text-gray-500 text-xs mb-1">Fecha inicio</p><p className="text-gray-300">{captacion.fecha_inicio}</p></div>}
            {captacion.fecha_fin && <div><p className="text-gray-500 text-xs mb-1">Fecha fin</p><p className="text-red-400">{captacion.fecha_fin}</p></div>}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Sin captación asignada.</p>
        )}
      </div>

      {/* ── MODAL: Responsables ─────────────────────────────────────────── */}
      {respServicio && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
              <div>
                <h3 className="text-white font-semibold">Responsables — {year}</h3>
                <p className="text-gray-400 text-xs mt-0.5">{respServicio.tipo_servicio?.nombre ?? respServicio.nombre}</p>
              </div>
              <button onClick={() => setRespServicio(null)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            {/* Month tabs */}
            <div className="flex gap-1 px-4 py-3 border-b border-gray-800 flex-wrap flex-shrink-0">
              {MESES_CORTO.map((m, i) => {
                const mes = i + 1
                const hasData = (responsablesMap.get(`${respServicio.id}_${mes}`) ?? []).length > 0
                return (
                  <button
                    key={mes}
                    onClick={() => switchRespMes(respServicio, mes)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors relative ${
                      respMes === mes ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {m}
                    {hasData && respMes !== mes && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-purple-400 rounded-full" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Employee list */}
            <div className="p-5 space-y-2 overflow-y-auto flex-1">
              {respEdit.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">
                  {respServicio.departamento
                    ? `El departamento "${respServicio.departamento.nombre}" no tiene miembros asignados. Ve a Departamentos para añadirlos.`
                    : 'Asigna un departamento al servicio para ver sus miembros, o se mostrarán todos los empleados activos.'}
                </p>
              )}
              {respEdit.map((emp, idx) => (
                <div
                  key={emp.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    emp.checked
                      ? 'bg-purple-900/20 border-purple-700/40'
                      : 'bg-gray-800/40 border-gray-700/40 hover:border-gray-600'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-purple-800/60 flex items-center justify-center text-purple-200 text-sm font-bold flex-shrink-0">
                    {initials(emp.nombre)}
                  </div>
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => setRespEdit(prev => prev.map((e, j) => j === idx ? { ...e, checked: !e.checked } : e))}
                    className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
                      emp.checked ? 'bg-purple-600 border-purple-500 text-white' : 'border-gray-600 text-transparent'
                    }`}
                  >
                    ✓
                  </button>
                  {/* Name */}
                  <span className={`flex-1 text-sm font-medium ${emp.checked ? 'text-white' : 'text-gray-400'}`}>
                    {emp.nombre}
                  </span>
                  {/* Percentage */}
                  {emp.checked && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={emp.porcentaje}
                        onChange={e => setRespEdit(prev => prev.map((r, j) => j === idx ? { ...r, porcentaje: parseInt(e.target.value) || 0 } : r))}
                        className="w-14 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-purple-500"
                      />
                      <span className="text-gray-400 text-xs">%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-800 flex-shrink-0 space-y-3">
              {/* Total % indicator */}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${totalPct === 100 ? 'bg-green-500' : totalPct > 100 ? 'bg-red-500' : 'bg-yellow-500'}`}
                    style={{ width: `${Math.min(totalPct, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-medium flex-shrink-0 ${totalPct === 100 ? 'text-green-400' : totalPct > 100 ? 'text-red-400' : 'text-yellow-400'}`}>
                  {totalPct}% {totalPct === 100 ? '✓' : totalPct > 100 ? '↑ excede 100%' : '↓ falta hasta 100%'}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copyForward}
                  disabled={savingResp}
                  title={`Copia esta asignación a ${MESES_CORTO[respMes - 1]}–Dic`}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  Copiar {MESES_CORTO[respMes - 1]}→Dic
                </button>
                <button
                  onClick={saveResp}
                  disabled={savingResp || (respEdit.some(e => e.checked) && totalPct !== 100)}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {savingResp ? 'Guardando…' : `Guardar ${MESES_CORTO[respMes - 1]}`}
                </button>
              </div>
              {respEdit.some(e => e.checked) && totalPct !== 100 && (
                <p className="text-yellow-500 text-xs text-center">Los porcentajes deben sumar exactamente 100%</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Editar cliente ───────────────────────────────────────── */}
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
                  <input type="text" value={clienteForm.nombre} onChange={e => setClienteForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Fecha de alta</label>
                  <input type="date" value={clienteForm.fecha_alta} onChange={e => setClienteForm(f => ({ ...f, fecha_alta: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Notas</label>
                  <textarea value={clienteForm.notas} onChange={e => setClienteForm(f => ({ ...f, notas: e.target.value }))} rows={3} className={`${inputCls} resize-none`} />
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

      {/* ── MODAL: Servicio ─────────────────────────────────────────────── */}
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

                {/* Tipo de servicio */}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Tipo de servicio *</label>
                  <select
                    value={servicioForm.id_tipo_servicio}
                    onChange={e => setServicioForm(f => ({ ...f, id_tipo_servicio: e.target.value }))}
                    className={inputCls}
                    autoFocus
                  >
                    <option value="">Selecciona un tipo…</option>
                    {tiposServicio.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Modalidad</label>
                    <select value={servicioForm.tipo} onChange={e => setServicioForm(f => ({ ...f, tipo: e.target.value as 'recurrente' | 'oneshot' }))} className={inputCls}>
                      <option value="recurrente">Recurrente</option>
                      <option value="oneshot">Oneshot</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Precio para este cliente (€)</label>
                    <input type="number" min="0" step="0.01" value={servicioForm.precio_base} onChange={e => setServicioForm(f => ({ ...f, precio_base: e.target.value }))} className={inputCls} placeholder="0" />
                  </div>
                </div>

                {/* Departamento */}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Departamento</label>
                  <select
                    value={servicioForm.id_departamento}
                    onChange={e => {
                      setServicioForm(f => ({ ...f, id_departamento: e.target.value }))
                      setServicioResponsables([])
                    }}
                    className={inputCls}
                  >
                    <option value="">Sin departamento</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>

                {/* Responsables — multi-checkbox */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Responsables del servicio</label>
                  {(() => {
                    const available = servicioForm.id_departamento && empleadosPorDepartamento[servicioForm.id_departamento]?.length
                      ? empleadosPorDepartamento[servicioForm.id_departamento]
                      : empleados
                    return (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {available.map(emp => {
                          const checked = servicioResponsables.includes(emp.id)
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => setServicioResponsables(prev =>
                                checked ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                              )}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                                checked
                                  ? 'bg-purple-900/20 border-purple-700/50 text-white'
                                  : 'bg-gray-800/40 border-gray-700/40 text-gray-400 hover:border-gray-600'
                              }`}
                            >
                              <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                                checked ? 'bg-purple-600 border-purple-500 text-white' : 'border-gray-600'
                              }`}>{checked ? '✓' : ''}</span>
                              {emp.nombre}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}
                  {servicioForm.id_departamento && empleadosPorDepartamento[servicioForm.id_departamento]?.length
                    ? <p className="text-gray-600 text-xs mt-1">Mostrando miembros del departamento</p>
                    : <p className="text-gray-600 text-xs mt-1">Mostrando todos los empleados activos</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Fecha inicio</label>
                    <input type="date" value={servicioForm.fecha_inicio} onChange={e => setServicioForm(f => ({ ...f, fecha_inicio: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Fecha fin</label>
                    <input type="date" value={servicioForm.fecha_fin} onChange={e => setServicioForm(f => ({ ...f, fecha_fin: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Notas</label>
                  <textarea value={servicioForm.notas} onChange={e => setServicioForm(f => ({ ...f, notas: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
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

      {/* ── MODAL: Captación ────────────────────────────────────────────── */}
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
                  <select value={captacionForm.id_captador} onChange={e => setCaptacionForm(f => ({ ...f, id_captador: e.target.value }))} className={inputCls}>
                    <option value="">Sin captador</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Mantenedor</label>
                  <select value={captacionForm.id_mantenedor} onChange={e => setCaptacionForm(f => ({ ...f, id_mantenedor: e.target.value }))} className={inputCls}>
                    <option value="">Sin mantenedor</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Fecha inicio</label>
                  <input type="date" value={captacionForm.fecha_inicio} onChange={e => setCaptacionForm(f => ({ ...f, fecha_inicio: e.target.value }))} className={inputCls} />
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
