'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'

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
  tipo: 'general' | 'departamento' | 'comision'
}

interface ResponsableData {
  id_servicio: string
  id_empleado: string
  nombre: string
  mes: number
  anio: number
  porcentaje: number
}

interface GastoRef {
  concepto: string
  valor: number
  tipo: string
  id_departamento: string | null
}

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
  gastosExistentes: GastoRef[]
  mrr: number
  total_facturado: number
  total_costes: number
  coste_personal: number
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
  gastosExistentes,
  mrr,
  total_facturado,
  total_costes,
  coste_personal,
  year,
}: Props) {
  const router = useRouter()

  // ── Gastos locales ───────────────────────────────────────────────────
  const [localGastos, setLocalGastos] = useState<Gasto[]>(gastos)
  const localTotalCostes = localGastos.reduce((s, g) => s + Number(g.valor), 0)

  const [showGastoModal, setShowGastoModal] = useState(false)
  const [gastoTodoElAnio, setGastoTodoElAnio] = useState(false)
  const [gastoForm, setGastoForm] = useState({
    concepto: '',
    valor: '',
    mes: String(new Date().getMonth() + 1),
    tipo: 'general' as 'general' | 'departamento' | 'comision',
    id_departamento: '',
  })

  const openCreateGasto = () => {
    setGastoForm({ concepto: '', valor: '', mes: String(new Date().getMonth() + 1), tipo: 'general', id_departamento: '' })
    setGastoTodoElAnio(false)
    setError('')
    setShowGastoModal(true)
  }

  const saveGasto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gastoForm.concepto.trim()) { setError('El concepto es obligatorio'); return }
    if (!gastoForm.valor) { setError('El valor es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const baseBody = {
        concepto: gastoForm.concepto,
        valor: parseFloat(gastoForm.valor),
        tipo: gastoForm.tipo,
        id_cliente: cliente.id,
        id_departamento: gastoForm.tipo === 'departamento' ? gastoForm.id_departamento || null : null,
        anio: year,
      }

      if (gastoTodoElAnio) {
        const results = await Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            fetch('/api/costes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...baseBody, mes: i + 1 }),
            })
          )
        )
        const failed = results.find(r => !r.ok)
        if (failed) { setError('Error al guardar'); return }
        const created = await Promise.all(results.map(r => r.json()))
        setLocalGastos(prev => [
          ...prev,
          ...created.map((g: Gasto) => ({ id: g.id, concepto: g.concepto, valor: g.valor, mes: g.mes, anio: g.anio, tipo: g.tipo })),
        ])
      } else {
        const res = await fetch('/api/costes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...baseBody, mes: parseInt(gastoForm.mes) }),
        })
        if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
        const created = await res.json()
        setLocalGastos(prev => [...prev, { id: created.id, concepto: created.concepto, valor: created.valor, mes: created.mes, anio: created.anio, tipo: created.tipo }])
      }
      setShowGastoModal(false)
    } finally { setSaving(false) }
  }

  const deleteGasto = async (id: string) => {
    askConfirm('Eliminar gasto', '¿Seguro que quieres eliminar este gasto?', async () => {
      setConfirmModal(null)
      await fetch(`/api/costes?id=${id}`, { method: 'DELETE' })
      setLocalGastos(prev => prev.filter(g => g.id !== id))
    })
  }

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
          body: JSON.stringify({ id: existing.id, valor, concepto: s.departamento?.nombre ?? s.nombre }),
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
  const [respError, setRespError] = useState('')
  const [respSaved, setRespSaved] = useState(false)

  const openRespModal = (s: Servicio) => {
    setRespServicio(s)
    setRespError('')
    setRespSaved(false)
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
    setRespError('')
    setRespSaved(false)
    loadRespEdit(s, mes)
  }

  const totalPct = respEdit.filter(e => e.checked).reduce((s, e) => s + e.porcentaje, 0)

  const saveResp = async () => {
    if (!respServicio) return
    setSavingResp(true)
    setRespError('')
    setRespSaved(false)
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
      setRespSaved(true)
      // Confirm data is persisted in DB
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      setRespError(d.error ?? 'Error al guardar. Inténtalo de nuevo.')
    }
    setSavingResp(false)
  }

  const copyForward = async () => {
    if (!respServicio) return
    setSavingResp(true)
    setRespError('')
    setRespSaved(false)
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
    const results = await Promise.all(promises)
    const failed = results.find(r => !r.ok)
    if (failed) {
      const d = await failed.json().catch(() => ({}))
      setRespError(d.error ?? 'Error al copiar en algún mes.')
      setSavingResp(false)
      return
    }

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
    setRespSaved(true)
    router.refresh()
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
    tipo: 'recurrente' as 'recurrente' | 'oneshot',
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
    setServicioForm({ tipo: 'recurrente', precio_base: '', id_departamento: '', fecha_inicio: '', fecha_fin: '', notas: '' })
    setServicioResponsables([])
    setError(''); setShowServicioModal(true)
  }

  const openEditServicio = (s: Servicio) => {
    setServicioMode('edit'); setEditServicioId(s.id)
    setServicioForm({
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
    if (!servicioForm.id_departamento) { setError('Selecciona un departamento'); return }
    setSaving(true); setError('')
    try {
      const deptNombre = departamentos.find(d => d.id === servicioForm.id_departamento)?.nombre ?? ''
      const base = {
        nombre: deptNombre,
        id_tipo_servicio: null,
        tipo: servicioForm.tipo,
        precio_base: servicioForm.precio_base ? parseFloat(servicioForm.precio_base) : null,
        id_departamento: servicioForm.id_departamento,
        fecha_inicio: servicioForm.fecha_inicio || null,
        fecha_fin: servicioForm.fecha_fin || null,
        notas: servicioForm.notas || null,
      }
      const body = servicioMode === 'create' ? { id_cliente: cliente.id, ...base } : { id: editServicioId, ...base }
      const res = await fetch('/api/servicios', { method: servicioMode === 'create' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      const saved = await res.json()

      // Auto-fill ingresos for new recurrent services with a precio_base
      if (servicioMode === 'create' && servicioForm.tipo === 'recurrente') {
        const precio = servicioForm.precio_base ? parseFloat(servicioForm.precio_base) : 0
        if (precio > 0) {
          const serviceForCheck = {
            fecha_inicio: servicioForm.fecha_inicio || null,
            fecha_fin: servicioForm.fecha_fin || null,
          } as Pick<Servicio, 'fecha_inicio' | 'fecha_fin'>
          const activeMeses = Array.from({ length: 12 }, (_, i) => i + 1).filter(mes =>
            isServiceActiveInMonth(serviceForCheck as Servicio, mes, year)
          )
          if (activeMeses.length > 0) {
            const ingresoResults = await Promise.all(
              activeMeses.map(mes =>
                fetch('/api/ingresos', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id_cliente: cliente.id,
                    id_servicio: saved.id,
                    concepto: deptNombre,
                    valor: precio,
                    mes,
                    anio: year,
                    id_departamento: servicioForm.id_departamento || null,
                  }),
                })
              )
            )
            // Update local ingresoMap with created ingresos
            const createdIngresos = await Promise.all(
              ingresoResults.filter(r => r.ok).map(r => r.json())
            )
            setIngresoMap(prev => {
              const next = new Map(prev)
              for (const result of createdIngresos) {
                const ing = Array.isArray(result) ? result[0] : result
                if (ing && ing.id) {
                  next.set(`${saved.id}_${ing.mes}`, {
                    id: ing.id,
                    concepto: ing.concepto,
                    valor: ing.valor,
                    mes: ing.mes,
                    anio: ing.anio,
                    id_servicio: ing.id_servicio,
                    id_departamento: ing.id_departamento,
                    id_responsable: ing.id_responsable ?? null,
                    notas: ing.notas ?? null,
                  })
                }
              }
              return next
            })
          }
        }
      }

      // Save base responsables for all active months if any selected (only on create)
      if (servicioMode === 'create' && servicioResponsables.length > 0) {
        const serviceForCheck = {
          fecha_inicio: servicioForm.fecha_inicio || null,
          fecha_fin: servicioForm.fecha_fin || null,
        } as Pick<Servicio, 'fecha_inicio' | 'fecha_fin'>
        const activeMeses = Array.from({ length: 12 }, (_, i) => i + 1).filter(mes =>
          isServiceActiveInMonth(serviceForCheck as Servicio, mes, year)
        )
        const asignaciones = servicioResponsables.map(id => ({
          id_empleado: id,
          porcentaje: Math.round(100 / servicioResponsables.length),
        }))
        await Promise.all(activeMeses.map(mes =>
          fetch('/api/servicio-responsables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_servicio: saved.id, mes, anio: year, asignaciones }),
          })
        ))
        // Update local responsablesMap
        setResponsablesMap(prev => {
          const next = new Map(prev)
          const savedResps = asignaciones.map(a => ({
            id_empleado: a.id_empleado,
            nombre: empleados.find(e => e.id === a.id_empleado)?.nombre ?? '',
            porcentaje: a.porcentaje,
          }))
          for (const mes of activeMeses) {
            next.set(`${saved.id}_${mes}`, savedResps)
          }
          return next
        })
      }

      // Auto-fill ingreso for oneshot with precio_base + fecha_inicio
      if (servicioMode === 'create' && servicioForm.tipo === 'oneshot') {
        const precio = servicioForm.precio_base ? parseFloat(servicioForm.precio_base) : 0
        if (precio > 0 && servicioForm.fecha_inicio) {
          const parts = servicioForm.fecha_inicio.split('-')
          const anioInicio = parseInt(parts[0])
          const mesInicio = parseInt(parts[1])
          if (anioInicio === year && mesInicio >= 1 && mesInicio <= 12) {
            const res = await fetch('/api/ingresos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id_cliente: cliente.id,
                id_servicio: saved.id,
                concepto: deptNombre,
                valor: precio,
                mes: mesInicio,
                anio: year,
                id_departamento: servicioForm.id_departamento || null,
              }),
            })
            if (res.ok) {
              const result = await res.json()
              const ing = Array.isArray(result) ? result[0] : result
              if (ing?.id) {
                setIngresoMap(prev => {
                  const next = new Map(prev)
                  next.set(`${saved.id}_${mesInicio}`, {
                    id: ing.id, concepto: ing.concepto, valor: ing.valor,
                    mes: ing.mes, anio: ing.anio, id_servicio: ing.id_servicio,
                    id_departamento: ing.id_departamento, id_responsable: ing.id_responsable ?? null, notas: ing.notas ?? null,
                  })
                  return next
                })
              }
            }
          }
        }
      }

      setShowServicioModal(false); router.refresh()
    } finally { setSaving(false) }
  }

  const toggleServicioActivo = async (s: Servicio) => {
    await fetch('/api/servicios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, activo: !s.activo }) })
    router.refresh()
  }

  const deleteServicio = async (s: Servicio) => {
    const label = s.departamento?.nombre ?? s.nombre
    askConfirm(
      'Eliminar servicio',
      `¿Eliminar el servicio "${label}"? Se eliminarán también todos sus ingresos registrados.`,
      async () => {
        setConfirmModal(null)
        await doDeleteServicio(s)
      }
    )
  }

  const doDeleteServicio = async (s: Servicio) => {
    // Delete ingresos associated to this service from local state
    const keysToDelete = Array.from(ingresoMap.keys()).filter(k => k.startsWith(`${s.id}_`))
    const ingresoIds = keysToDelete.map(k => ingresoMap.get(k)!.id)
    await Promise.all([
      ...ingresoIds.map(id => fetch(`/api/ingresos?id=${id}`, { method: 'DELETE' })),
      fetch(`/api/servicios?id=${s.id}`, { method: 'DELETE' }),
    ])
    setIngresoMap(prev => {
      const next = new Map(prev)
      keysToDelete.forEach(k => next.delete(k))
      return next
    })
    router.refresh()
  }

  const rellenarConPrecioBase = async (s: Servicio) => {
    if (!s.precio_base || s.precio_base <= 0) return
    const vaciosMeses = Array.from({ length: 12 }, (_, i) => i + 1).filter(mes => {
      if (!isServiceActiveInMonth(s, mes, year)) return false
      return !ingresoMap.has(`${s.id}_${mes}`)
    })
    if (vaciosMeses.length === 0) return
    const results = await Promise.all(
      vaciosMeses.map(mes =>
        fetch('/api/ingresos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_cliente: cliente.id,
            id_servicio: s.id,
            concepto: s.departamento?.nombre ?? s.nombre,
            valor: s.precio_base,
            mes,
            anio: year,
            id_departamento: s.departamento?.id ?? null,
            id_responsable: s.responsable?.id ?? null,
          }),
        })
      )
    )
    const created = await Promise.all(results.filter(r => r.ok).map(r => r.json()))
    setIngresoMap(prev => {
      const next = new Map(prev)
      for (const result of created) {
        const ing = Array.isArray(result) ? result[0] : result
        if (ing?.id) {
          next.set(`${s.id}_${ing.mes}`, {
            id: ing.id, concepto: ing.concepto, valor: ing.valor,
            mes: ing.mes, anio: ing.anio, id_servicio: ing.id_servicio,
            id_departamento: ing.id_departamento, id_responsable: ing.id_responsable ?? null, notas: ing.notas ?? null,
          })
        }
      }
      return next
    })
  }

  const [fillingHistorico, setFillingHistorico] = useState<string | null>(null)

  const rellenarHistorico = async (s: Servicio) => {
    // Use service fecha_inicio, or client fecha_alta, or default to 2023-01-01
    const fechaRef = s.fecha_inicio ?? cliente.fecha_alta ?? '2023-01-01'

    setFillingHistorico(s.id)
    try {
      // 1. Get all existing ingresos for this service (all years)
      const res = await fetch(`/api/ingresos?id_servicio=${s.id}`)
      const existentes: { id: string; mes: number; anio: number; valor: number }[] = await res.json()
      const existentesSet = new Set(existentes.map(e => `${e.anio}_${e.mes}`))

      // Determine fill value: precio_base → last known ingreso → 0 (won't fill)
      const valorFill = (s.precio_base && s.precio_base > 0)
        ? s.precio_base
        : existentes.length > 0
          ? existentes[existentes.length - 1].valor
          : 0
      if (!valorFill || valorFill <= 0) { setFillingHistorico(null); return }

      // 2. Build list of all month/year from fechaRef to today (or fecha_fin)
      const inicioDate = new Date(fechaRef)
      const inicioAnio = inicioDate.getFullYear()
      const inicioMes = inicioDate.getMonth() + 1

      const finDate = s.fecha_fin ? new Date(s.fecha_fin) : new Date()
      const finAnio = finDate.getFullYear()
      const finMes = finDate.getMonth() + 1

      const toCreate: { mes: number; anio: number }[] = []
      for (let anio = inicioAnio; anio <= finAnio; anio++) {
        const mesStart = anio === inicioAnio ? inicioMes : 1
        const mesEnd = anio === finAnio ? finMes : 12
        for (let mes = mesStart; mes <= mesEnd; mes++) {
          if (!existentesSet.has(`${anio}_${mes}`)) {
            toCreate.push({ mes, anio })
          }
        }
      }

      if (toCreate.length === 0) {
        setFillingHistorico(null)
        return
      }

      // 3. Create all missing ingresos in batches
      await Promise.all(
        toCreate.map(({ mes, anio }) =>
          fetch('/api/ingresos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_cliente: cliente.id,
              id_servicio: s.id,
              concepto: s.departamento?.nombre ?? s.nombre,
              valor: valorFill,
              mes,
              anio,
              id_departamento: s.departamento?.id ?? null,
            }),
          })
        )
      )

      router.refresh()
    } finally {
      setFillingHistorico(null)
    }
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
  const years = Array.from({ length: currentYear - 2023 + 2 }, (_, i) => 2023 + i)

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  const askConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirmModal({ title, message, onConfirm })

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

  return (
    <div className="p-6 space-y-6">
      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title ?? ''}
        message={confirmModal?.message ?? ''}
        onConfirm={confirmModal?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmModal(null)}
      />
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Facturación mensual</p>
          <p className={`text-2xl font-bold mt-1 ${mrr > 0 ? 'text-green-400' : 'text-gray-500'}`}>{fmt(mrr)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Facturado {year}</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(grandTotal)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Gastos directos {year}</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{fmt(localTotalCostes)}</p>
          <p className="text-gray-500 text-xs mt-0.5">{localGastos.length} partidas</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Coste personal {year}</p>
          <p className={`text-2xl font-bold mt-1 ${coste_personal > 0 ? 'text-orange-400' : 'text-gray-500'}`}>{fmt(coste_personal)}</p>
          <p className="text-gray-500 text-xs mt-0.5">sueldo × responsabilidad</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Margen {year}</p>
          {(() => {
            const margen = grandTotal - localTotalCostes - coste_personal
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
                      <div className="flex items-start gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${s.activo ? 'bg-green-400' : 'bg-gray-600'}`} />
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate max-w-[140px]" title={s.departamento?.nombre ?? s.nombre}>{s.departamento?.nombre ?? s.nombre}</p>
                          {s.notas && <p className="text-gray-400 text-[11px] truncate max-w-[140px] mt-0.5 leading-tight" title={s.notas}>{s.notas}</p>}
                        </div>
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
                        {s.tipo === 'recurrente' && s.precio_base && s.precio_base > 0 && (
                          <button
                            onClick={() => rellenarConPrecioBase(s)}
                            title={`Rellenar meses vacíos de ${year} con ${fmt(s.precio_base)}/mes`}
                            className="text-gray-500 hover:text-yellow-400 px-1.5 py-1 rounded hover:bg-gray-700 transition-colors text-sm"
                          >
                            ⚡
                          </button>
                        )}
                        {s.tipo === 'recurrente' && (
                          <button
                            onClick={() => rellenarHistorico(s)}
                            disabled={fillingHistorico === s.id}
                            title={`Rellenar histórico completo desde ${s.fecha_inicio ?? cliente.fecha_alta ?? '2023'} hasta hoy`}
                            className="text-gray-500 hover:text-blue-400 px-1.5 py-1 rounded hover:bg-gray-700 transition-colors text-sm disabled:opacity-40"
                          >
                            {fillingHistorico === s.id ? '⏳' : '📅'}
                          </button>
                        )}
                        <button
                          onClick={() => openRespModal(s)}
                          title="Gestionar responsables"
                          className="text-gray-500 hover:text-purple-400 px-1.5 py-1 rounded hover:bg-gray-700 transition-colors text-sm"
                        >
                          👥
                        </button>
                        <button onClick={() => openEditServicio(s)} className="text-gray-500 hover:text-white px-1.5 py-1 rounded hover:bg-gray-700 transition-colors">✏️</button>
                        <button onClick={() => toggleServicioActivo(s)} className={`px-1.5 py-1 rounded hover:bg-gray-700 transition-colors text-[10px] ${s.activo ? 'text-gray-500 hover:text-orange-400' : 'text-gray-600 hover:text-green-400'}`}>
                          {s.activo ? 'OFF' : 'ON'}
                        </button>
                        <button onClick={() => deleteServicio(s)} className="text-gray-600 hover:text-red-400 px-1.5 py-1 rounded hover:bg-gray-700 transition-colors text-xs" title="Eliminar servicio">🗑</button>
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

      {/* Costes imputados — tabla pivot */}
      {(() => {
        const conceptos = [...new Set(localGastos.map(g => g.concepto))].sort()
        const gastosByConceptoMes = new Map<string, Map<number, { id: string; valor: number }>>()
        for (const g of localGastos) {
          if (!gastosByConceptoMes.has(g.concepto)) gastosByConceptoMes.set(g.concepto, new Map())
          const prev = gastosByConceptoMes.get(g.concepto)!.get(g.mes)
          gastosByConceptoMes.get(g.concepto)!.set(g.mes, {
            id: g.id,
            valor: (prev?.valor ?? 0) + Number(g.valor),
          })
        }
        const monthTotals = Array.from({ length: 12 }, (_, i) => {
          const mes = i + 1
          return conceptos.reduce((s, c) => s + (gastosByConceptoMes.get(c)?.get(mes)?.valor ?? 0), 0)
        })
        const deleteConceptoGastos = (concepto: string) => {
          askConfirm('Eliminar concepto', `¿Eliminar todos los gastos de "${concepto}"?`, async () => {
            setConfirmModal(null)
            const ids = localGastos.filter(g => g.concepto === concepto).map(g => g.id)
            await Promise.all(ids.map(id => fetch(`/api/costes?id=${id}`, { method: 'DELETE' })))
            setLocalGastos(prev => prev.filter(g => g.concepto !== concepto))
          })
        }
        return (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h3 className="text-white font-semibold">Costes imputados {year}</h3>
                <p className="text-gray-500 text-xs mt-0.5">Gastos de la agencia asignados a este cliente · añádelos desde Costes</p>
              </div>
              <span className="text-red-400 font-bold text-lg">{fmt(localTotalCostes)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-800/50 text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5 sticky left-0 bg-gray-800/50 z-10 min-w-[160px]">Concepto</th>
                    {MESES_CORTO.map(m => <th key={m} className="text-right px-2 py-2.5 min-w-[64px]">{m}</th>)}
                    <th className="text-right px-4 py-2.5 min-w-[72px]">Total</th>
                    <th className="px-3 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {conceptos.length === 0 && (
                    <tr><td colSpan={15} className="text-center text-gray-500 py-8">Sin gastos imputados en {year}</td></tr>
                  )}
                  {conceptos.map(concepto => {
                    const mesMap = gastosByConceptoMes.get(concepto)!
                    const rowTotal = Array.from(mesMap.values()).reduce((s, v) => s + v.valor, 0)
                    return (
                      <tr key={concepto} className="border-b border-gray-800/30 hover:bg-gray-800/20 group">
                        <td className="px-4 py-2 sticky left-0 bg-gray-900 group-hover:bg-gray-800/20 z-10 border-r border-gray-800/30">
                          <span className="text-white font-medium">{concepto}</span>
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const v = mesMap.get(i + 1)
                          return (
                            <td key={i} className="px-2 py-2 text-right">
                              {v ? <span className="text-red-400 font-medium">{fmt(v.valor)}</span> : <span className="text-gray-700">—</span>}
                            </td>
                          )
                        })}
                        <td className="px-4 py-2 text-right text-red-400 font-bold">{fmt(rowTotal)}</td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => deleteConceptoGastos(concepto)}
                            className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 px-1"
                            title="Eliminar concepto"
                          >✕</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {conceptos.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-gray-700 bg-gray-800/30">
                      <td className="px-4 py-3 sticky left-0 bg-gray-800/30 z-10 text-gray-400 font-semibold text-xs uppercase">Total</td>
                      {monthTotals.map((t, i) => (
                        <td key={i} className="px-2 py-3 text-right">
                          {t > 0 ? <span className="text-white font-bold">{fmt(t)}</span> : <span className="text-gray-700">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right text-white font-bold">{fmt(localTotalCostes)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )
      })()}

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
                <p className="text-gray-400 text-xs mt-0.5">{respServicio.departamento?.nombre ?? respServicio.nombre}</p>
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

              {respError && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-xs">{respError}</div>
              )}
              {respSaved && !respError && (
                <div className="bg-green-900/30 border border-green-800 rounded-lg px-3 py-2 text-green-400 text-xs">✓ Guardado correctamente</div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={copyForward}
                  disabled={savingResp}
                  title={`Copia esta asignación a ${MESES_CORTO[respMes - 1]}–Dic`}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  {savingResp ? '…' : `Copiar ${MESES_CORTO[respMes - 1]}→Dic`}
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

                {/* Departamento (= servicio) */}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Departamento *</label>
                  <select
                    value={servicioForm.id_departamento}
                    onChange={e => {
                      setServicioForm(f => ({ ...f, id_departamento: e.target.value }))
                      setServicioResponsables([])
                    }}
                    className={inputCls}
                    autoFocus
                  >
                    <option value="">Selecciona un departamento…</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
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
                  <label className="block text-gray-400 text-sm mb-1">Asunto / descripción del servicio</label>
                  <textarea value={servicioForm.notas} onChange={e => setServicioForm(f => ({ ...f, notas: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Ej: Gestión Google Ads, Redacción blog, Diseño web..." />
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

      {/* ── MODAL: Gasto ────────────────────────────────────────────────── */}
      {showGastoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
              <h3 className="text-white font-semibold">Añadir gasto — {cliente.nombre}</h3>
              <button onClick={() => setShowGastoModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={saveGasto}>
              <div className="p-6 space-y-4">
                {error && <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm">{error}</div>}

                {/* Toggle todo el año */}
                <button type="button" onClick={() => setGastoTodoElAnio(v => !v)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    gastoTodoElAnio ? 'bg-orange-900/20 border-orange-700/50 text-orange-300' : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}>
                  <span>Mismo gasto todo el año ({year})</span>
                  <span className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${gastoTodoElAnio ? 'bg-orange-500' : 'bg-gray-600'}`}>
                    <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${gastoTodoElAnio ? 'translate-x-4' : 'translate-x-0'}`} />
                  </span>
                </button>
                {gastoTodoElAnio && <p className="text-orange-400/80 text-xs -mt-2 px-1">Se crearán 12 entradas, una por cada mes de {year}</p>}

                {/* Concepto con datalist — auto-rellena valor/tipo/depto al seleccionar */}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Concepto *</label>
                  <input
                    type="text"
                    list="conceptos-list-cliente"
                    value={gastoForm.concepto}
                    onChange={e => {
                      const val = e.target.value
                      const ref = gastosExistentes.find(g => g.concepto === val)
                      if (ref) {
                        setGastoForm(f => ({
                          ...f,
                          concepto: val,
                          valor: String(ref.valor),
                          tipo: (ref.tipo as 'general' | 'departamento' | 'comision') ?? 'general',
                          id_departamento: ref.id_departamento ?? '',
                        }))
                      } else {
                        setGastoForm(f => ({ ...f, concepto: val }))
                      }
                    }}
                    className={inputCls}
                    placeholder="Ej: Alquiler, Comisión venta…"
                    autoFocus
                  />
                  <datalist id="conceptos-list-cliente">
                    {gastosExistentes.map(g => <option key={g.concepto} value={g.concepto} />)}
                  </datalist>
                  {gastosExistentes.find(g => g.concepto === gastoForm.concepto) && (
                    <p className="text-green-600 text-xs mt-1">✓ Concepto existente — valores pre-rellenados</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Valor (€) *</label>
                    <input type="number" min="0" step="0.01" value={gastoForm.valor}
                      onChange={e => setGastoForm(f => ({ ...f, valor: e.target.value }))}
                      className={inputCls} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Tipo</label>
                    <select value={gastoForm.tipo}
                      onChange={e => setGastoForm(f => ({ ...f, tipo: e.target.value as 'general' | 'departamento' | 'comision', id_departamento: '' }))}
                      className={inputCls}>
                      <option value="general">General</option>
                      <option value="departamento">Departamento</option>
                      <option value="comision">Comisión</option>
                    </select>
                  </div>
                </div>

                {/* Departamento — solo cuando tipo=departamento */}
                {gastoForm.tipo === 'departamento' && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Departamento</label>
                    <select value={gastoForm.id_departamento}
                      onChange={e => setGastoForm(f => ({ ...f, id_departamento: e.target.value }))}
                      className={inputCls}>
                      <option value="">Seleccionar…</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                    </select>
                  </div>
                )}

                {/* Mes — solo cuando no es todo el año */}
                {!gastoTodoElAnio && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Mes</label>
                    <select value={gastoForm.mes} onChange={e => setGastoForm(f => ({ ...f, mes: e.target.value }))} className={inputCls}>
                      {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
                <button type="button" onClick={() => setShowGastoModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Guardando...' : gastoTodoElAnio ? 'Añadir 12 meses' : 'Añadir'}
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
