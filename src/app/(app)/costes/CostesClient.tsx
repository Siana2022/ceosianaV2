'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface Departamento { id: string; nombre: string }

interface Gasto {
  id: string
  concepto: string
  valor: number
  tipo: 'general' | 'departamento' | 'comision'
  id_departamento: string | null
  departamento: { id: string; nombre: string } | null
  id_cliente: string | null
  cliente: { id: string; nombre: string } | null
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
  clientes: { id: string; nombre: string }[]
  mes: number | null
  anio: number
  vistaAnual: boolean
}

type CategoriaGasto = 'fijo' | 'departamento' | 'comision' | 'cliente'

interface GastoForm {
  concepto: string
  valor: string
  categoria: CategoriaGasto
  id_departamento: string
  id_cliente: string
}

export default function CostesClient({ gastos, sueldos, departamentos, clientes, mes, anio, vistaAnual }: Props) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2023 + 2 }, (_, i) => 2023 + i)

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  const askConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirmModal({ title, message, onConfirm })

  // Gasto modal
  const [showGastoModal, setShowGastoModal] = useState(false)
  const [gastoEditMode, setGastoEditMode] = useState(false)
  const [editGastoId, setEditGastoId] = useState<string | null>(null)
  const [gastoForm, setGastoForm] = useState<GastoForm>({ concepto: '', valor: '', categoria: 'fijo', id_departamento: '', id_cliente: '' })
  const [todoElAnio, setTodoElAnio] = useState(false)
  const [mesSingle, setMesSingle] = useState(new Date().getMonth() + 1)

  // Edit concepto modal (metadata for all 12 months)
  const [editConceptoModal, setEditConceptoModal] = useState<{
    concepto: string
    categoria: CategoriaGasto
    id_departamento: string
    id_cliente: string
  } | null>(null)
  const [editConceptoForm, setEditConceptoForm] = useState({ concepto: '', categoria: 'fijo' as CategoriaGasto, id_departamento: '', id_cliente: '' })
  const [savingConcepto, setSavingConcepto] = useState(false)

  // Sueldo edit
  const [editSueldoId, setEditSueldoId] = useState<string | null>(null)
  const [sueldoValor, setSueldoValor] = useState('')

  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState('')

  const goTo = (m: number, y: number) => router.push(`/costes?mes=${m}&anio=${y}`)

  const openCreateGasto = (categoria: CategoriaGasto = 'fijo') => {
    setGastoEditMode(false)
    setEditGastoId(null)
    setGastoForm({ concepto: '', valor: '', categoria, id_departamento: '', id_cliente: '' })
    setTodoElAnio(vistaAnual) // default ON in annual view
    setMesSingle(mes ?? new Date().getMonth() + 1)
    setError('')
    setShowGastoModal(true)
  }

  const openEditGasto = (g: Gasto) => {
    setGastoEditMode(true)
    setEditGastoId(g.id)
    const categoria: CategoriaGasto = g.tipo === 'comision' ? 'comision'
      : g.tipo === 'departamento' ? 'departamento'
      : g.id_cliente ? 'cliente'
      : 'fijo'
    setGastoForm({ concepto: g.concepto, valor: String(g.valor), categoria, id_departamento: g.id_departamento ?? '', id_cliente: g.id_cliente ?? '' })
    setTodoElAnio(false)
    setError('')
    setShowGastoModal(true)
  }

  const handleGastoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gastoForm.concepto.trim()) { setError('El concepto es obligatorio'); return }
    if (!gastoForm.valor) { setError('El valor es obligatorio'); return }
    if (gastoForm.categoria === 'comision' && !gastoForm.id_cliente) { setError('La comisión debe asignarse a un cliente'); return }
    if (gastoForm.categoria === 'cliente' && !gastoForm.id_cliente) { setError('Debes seleccionar un cliente'); return }
    if (gastoForm.categoria === 'departamento' && !gastoForm.id_departamento) { setError('Debes seleccionar un departamento'); return }
    setSaving(true); setError('')
    try {
      const apiTipo = gastoForm.categoria === 'comision' ? 'comision'
        : gastoForm.categoria === 'departamento' ? 'departamento'
        : 'general'

      const baseBody = {
        concepto: gastoForm.concepto,
        valor: parseFloat(gastoForm.valor),
        tipo: apiTipo,
        id_departamento: gastoForm.categoria === 'departamento' ? gastoForm.id_departamento || null : null,
        id_cliente: (gastoForm.categoria === 'comision' || gastoForm.categoria === 'cliente') ? gastoForm.id_cliente || null : null,
      }

      const targetMes = vistaAnual ? mesSingle : mes!

      if (gastoEditMode) {
        const res = await fetch('/api/costes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editGastoId, ...baseBody, mes: targetMes, anio }),
        })
        if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      } else if (todoElAnio) {
        // Create one entry per month of the year in parallel
        const results = await Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            fetch('/api/costes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...baseBody, mes: i + 1, anio }),
            })
          )
        )
        const failed = results.find(r => !r.ok)
        if (failed) {
          const errData = await failed.json().catch(() => ({}))
          setError(errData.error ?? 'Error al guardar algún mes')
          return
        }
      } else {
        const res = await fetch('/api/costes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...baseBody, mes: targetMes, anio }),
        })
        if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return }
      }

      setShowGastoModal(false)
      router.refresh()
    } finally { setSaving(false) }
  }

  const handleDeleteGasto = async (id: string) => {
    askConfirm('Eliminar gasto', '¿Seguro que quieres eliminar este gasto?', async () => {
      setConfirmModal(null)
      await fetch(`/api/costes?id=${id}`, { method: 'DELETE' })
      router.refresh()
    })
  }

  const handleDeleteConceptoRow = async (concepto: string) => {
    const allGastos = Array.from(gastosDetail.get(concepto)?.values() ?? []).flat()
    if (allGastos.length === 0) return
    const plural = allGastos.length === 1 ? '1 entrada' : `${allGastos.length} entradas`
    askConfirm('Eliminar concepto', `¿Eliminar "${concepto}" (${plural})? Esta acción no se puede deshacer.`, async () => {
      setConfirmModal(null)
      await Promise.all(allGastos.map(g => fetch(`/api/costes?id=${g.id}`, { method: 'DELETE' })))
      router.refresh()
    })
  }

  const openEditConceptoModal = (concepto: string) => {
    const firstGasto = Array.from(gastosDetail.get(concepto)?.values() ?? []).flat()[0]
    if (!firstGasto) return
    // id_cliente may be a raw UUID or the join object; check both
    const clienteId = firstGasto.id_cliente ?? (firstGasto.cliente as { id: string } | null)?.id ?? null
    const categoria: CategoriaGasto = firstGasto.tipo === 'comision' ? 'comision'
      : firstGasto.tipo === 'departamento' ? 'departamento'
      : clienteId ? 'cliente'
      : 'fijo'
    setEditConceptoForm({
      concepto,
      categoria,
      id_departamento: firstGasto.id_departamento ?? '',
      id_cliente: clienteId ?? '',
    })
    setEditConceptoModal({ concepto, categoria, id_departamento: firstGasto.id_departamento ?? '', id_cliente: clienteId ?? '' })
  }

  const saveEditConcepto = async () => {
    if (!editConceptoModal) return
    setSavingConcepto(true)
    const allGastos = Array.from(gastosDetail.get(editConceptoModal.concepto)?.values() ?? []).flat()
    const apiTipo = editConceptoForm.categoria === 'comision' ? 'comision'
      : editConceptoForm.categoria === 'departamento' ? 'departamento'
      : 'general'
    await Promise.all(allGastos.map(g =>
      fetch('/api/costes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: g.id,
          concepto: editConceptoForm.concepto,
          valor: g.valor,
          tipo: apiTipo,
          mes: g.mes,
          anio: g.anio,
          id_departamento: editConceptoForm.categoria === 'departamento' ? editConceptoForm.id_departamento || null : null,
          id_cliente: (editConceptoForm.categoria === 'comision' || editConceptoForm.categoria === 'cliente') ? editConceptoForm.id_cliente || null : null,
        })
      })
    ))
    setSavingConcepto(false)
    setEditConceptoModal(null)
    router.refresh()
  }

  const handleCopiarMesAnterior = async () => {
    askConfirm('Copiar mes anterior', '¿Copiar los gastos fijos del mes anterior a este mes?', async () => {
      setConfirmModal(null)
      await doCopiarMesAnterior()
    })
  }

  const doCopiarMesAnterior = async () => {
    setCopying(true)
    try {
      const prevMes = (mes ?? 1) === 1 ? 12 : (mes ?? 1) - 1
      const prevAnio = (mes ?? 1) === 1 ? anio - 1 : anio
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

  // ── Filter gastos into 4 groups ─────────────────────────────────────────
  const gastosFijos = gastos.filter(g => g.tipo === 'general' && !g.id_cliente)
  const gastosComisiones = gastos.filter(g => g.tipo === 'comision')
  const gastosDepartamentos = gastos.filter(g => g.tipo === 'departamento')
  const gastosClientes = gastos.filter(g => g.tipo === 'general' && !!g.id_cliente)

  const totalGastosFijos = gastosFijos.reduce((s, g) => s + Number(g.valor), 0)
  const totalGastosComisiones = gastosComisiones.reduce((s, g) => s + Number(g.valor), 0)
  const totalGastosDepartamentos = gastosDepartamentos.reduce((s, g) => s + Number(g.valor), 0)
  const totalGastosClientes = gastosClientes.reduce((s, g) => s + Number(g.valor), 0)
  const totalGastos = gastos.reduce((s, g) => s + Number(g.valor), 0)
  const totalSueldos = sueldos.reduce((s, r) => s + Number(r.coste_total ?? 0), 0)
  const totalCombinado = totalGastos + totalSueldos

  // ── Annual cell editing (gastos) — unified gastosDetail for all categories ──
  const [editingAnnualCell, setEditingAnnualCell] = useState<{ concepto: string; mes: number } | null>(null)
  const [annualCellValue, setAnnualCellValue] = useState('')
  const annualCellRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingAnnualCell && annualCellRef.current) {
      annualCellRef.current.focus()
      annualCellRef.current.select()
    }
  }, [editingAnnualCell])

  // ── Annual cell editing (sueldos) ─────────────────────────────────────
  const [editingAnnualSueldoCell, setEditingAnnualSueldoCell] = useState<{ empId: string; mes: number } | null>(null)
  const [annualSueldoCellValue, setAnnualSueldoCellValue] = useState('')
  const annualSueldoCellRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingAnnualSueldoCell && annualSueldoCellRef.current) {
      annualSueldoCellRef.current.focus()
      annualSueldoCellRef.current.select()
    }
  }, [editingAnnualSueldoCell])

  const saveAnnualSueldoCell = async (empId: string, m: number) => {
    const valor = parseFloat(annualSueldoCellValue)
    const isEmpty = annualSueldoCellValue.trim() === '' || isNaN(valor)
    setEditingAnnualSueldoCell(null)
    if (isEmpty) return
    await fetch('/api/sueldos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_empleado: empId, coste_total: valor, mes: m, anio }),
    })
    router.refresh()
  }

  // ── Annual matrices — unified gastosDetail (all categories) for cell editing ──
  const gastosDetail = new Map<string, Map<number, Gasto[]>>()
  for (const g of gastos) {
    if (!gastosDetail.has(g.concepto)) gastosDetail.set(g.concepto, new Map())
    const dm = gastosDetail.get(g.concepto)!
    if (!dm.has(g.mes)) dm.set(g.mes, [])
    dm.get(g.mes)!.push(g)
  }

  const saveAnnualCell = async (concepto: string, mes: number) => {
    const cellGastos = gastosDetail.get(concepto)?.get(mes) ?? []
    const valor = parseFloat(annualCellValue)
    const isEmpty = annualCellValue.trim() === '' || isNaN(valor)
    setEditingAnnualCell(null)

    if (isEmpty && cellGastos.length === 0) return

    if ((isEmpty || valor === 0) && cellGastos.length === 1) {
      await fetch(`/api/costes?id=${cellGastos[0].id}`, { method: 'DELETE' })
    } else if (!isEmpty && valor > 0 && cellGastos.length === 1) {
      // Pass all gasto fields to avoid the API clearing id_cliente / id_departamento
      const g = cellGastos[0]
      await fetch('/api/costes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: g.id,
          valor,
          concepto: g.concepto,
          tipo: g.tipo,
          id_departamento: g.id_departamento,
          id_cliente: g.id_cliente,
          mes: g.mes,
          anio: g.anio,
        }),
      })
    } else if (!isEmpty && valor > 0 && cellGastos.length === 0) {
      // Create new entry inheriting tipo/dept/cliente from another month
      const template = Array.from(gastosDetail.get(concepto)?.values() ?? []).flat()[0]
      if (template) {
        await fetch('/api/costes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            concepto, valor, mes, anio,
            tipo: template.tipo,
            id_departamento: template.id_departamento,
            id_cliente: template.id_cliente,
          }),
        })
      }
    }
    router.refresh()
  }

  // ── Annual matrices per category ─────────────────────────────────────────
  function buildMatriz(subset: Gasto[]) {
    const matriz = new Map<string, Map<number, number>>()
    const detail = new Map<string, Map<number, Gasto[]>>()
    for (const g of subset) {
      if (!matriz.has(g.concepto)) matriz.set(g.concepto, new Map())
      const m = matriz.get(g.concepto)!
      m.set(g.mes, (m.get(g.mes) ?? 0) + Number(g.valor))
      if (!detail.has(g.concepto)) detail.set(g.concepto, new Map())
      const dm = detail.get(g.concepto)!
      if (!dm.has(g.mes)) dm.set(g.mes, [])
      dm.get(g.mes)!.push(g)
    }
    return { matriz, detail, conceptos: Array.from(matriz.keys()).sort() }
  }

  const matrizFijos = buildMatriz(gastosFijos)
  const matrizComisiones = buildMatriz(gastosComisiones)
  const matrizDepartamentos = buildMatriz(gastosDepartamentos)
  const matrizClientes = buildMatriz(gastosClientes)

  // Sueldos: empleado → (mes → coste_total)
  const sueldosAnualesMap = new Map<string, { nombre: string; meses: Map<number, number | null> }>()
  for (const s of sueldos) {
    if (!sueldosAnualesMap.has(s.id_empleado))
      sueldosAnualesMap.set(s.id_empleado, { nombre: s.nombre, meses: new Map() })
    sueldosAnualesMap.get(s.id_empleado)!.meses.set(s.mes, s.coste_total)
  }
  const empAnuales = Array.from(sueldosAnualesMap.entries())

  // ── Render annual gasto matrix block ─────────────────────────────────────
  function renderAnualMatriz(
    title: string,
    categoria: CategoriaGasto,
    { matriz, detail: _detail, conceptos }: ReturnType<typeof buildMatriz>,
    totalGroup: number,
  ) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-wrap gap-2">
          <div>
            <h3 className="text-white font-semibold">{title} {anio}</h3>
            <p className="text-gray-500 text-xs mt-0.5">Pincha en un mes para editar</p>
          </div>
          <button onClick={() => openCreateGasto(categoria)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            + Añadir
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left text-gray-400 font-medium py-2.5 px-4 min-w-[180px] sticky left-0 bg-gray-800/50 z-10">Concepto</th>
                {MESES_CORTO.map((m, i) => (
                  <th key={m} className="text-center font-medium py-2.5 px-2 min-w-[70px]">
                    <button onClick={() => goTo(i + 1, anio)} className="text-gray-400 hover:text-blue-400 transition-colors w-full">{m}</button>
                  </th>
                ))}
                <th className="text-right text-gray-400 font-medium py-2.5 px-4 min-w-[80px]">Total</th>
                <th className="text-center text-gray-400 font-medium py-2.5 px-2 min-w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {conceptos.length === 0 && (
                <tr><td colSpan={15} className="text-center text-gray-500 py-8">Sin entradas en {anio}</td></tr>
              )}
              {conceptos.map(concepto => {
                const mesMap = matriz.get(concepto)!
                const rowTotal = Array.from(mesMap.values()).reduce((a, b) => a + b, 0)
                return (
                  <tr key={concepto} className="border-b border-gray-800/30 hover:bg-gray-800/20 group">
                    <td className="py-1.5 px-4 sticky left-0 bg-gray-900 z-10 border-r border-gray-800/30">
                      <button
                        onClick={() => openEditConceptoModal(concepto)}
                        title="Clic para editar este concepto"
                        className="text-white font-medium truncate max-w-[180px] hover:text-blue-400 transition-colors text-left w-full"
                      >
                        {concepto}
                      </button>
                      {(() => {
                        const sample = Array.from(gastosDetail.get(concepto)?.values() ?? []).flat()[0]
                        if (!sample) return null
                        if (sample.departamento) return <span className="text-[10px] text-blue-400">{sample.departamento.nombre}</span>
                        if (sample.cliente) return <span className="text-[10px] text-purple-400">{sample.cliente.nombre}</span>
                        return null
                      })()}
                    </td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = i + 1
                      const v = mesMap.get(m) ?? 0
                      const cellGastos = gastosDetail.get(concepto)?.get(m) ?? []
                      const hasMultiple = cellGastos.length > 1
                      const isEditing = editingAnnualCell?.concepto === concepto && editingAnnualCell?.mes === m
                      return (
                        <td key={i} className="py-1 px-1 text-center">
                          {isEditing ? (
                            <input
                              ref={annualCellRef}
                              type="number"
                              value={annualCellValue}
                              onChange={e => setAnnualCellValue(e.target.value)}
                              onBlur={() => saveAnnualCell(concepto, m)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') e.currentTarget.blur()
                                if (e.key === 'Escape') setEditingAnnualCell(null)
                              }}
                              className="w-16 bg-blue-900/40 border border-blue-500 rounded text-center text-white text-xs px-1 py-1 focus:outline-none"
                            />
                          ) : (
                            <button
                              onClick={() => {
                                if (hasMultiple) { goTo(m, anio); return }
                                setEditingAnnualCell({ concepto, mes: m })
                                setAnnualCellValue(v > 0 ? String(v) : '')
                              }}
                              title={hasMultiple ? `${cellGastos.length} entradas · ir al mes para editar` : v > 0 ? 'Clic para editar' : 'Clic para añadir'}
                              className={`w-full min-w-[60px] py-1 rounded transition-colors text-center ${
                                hasMultiple ? 'text-yellow-400 hover:bg-yellow-900/10 cursor-pointer' :
                                v > 0 ? 'text-red-400 font-medium hover:bg-red-900/20 cursor-pointer' :
                                'text-gray-700 hover:bg-gray-800/40 cursor-pointer'
                              }`}
                            >
                              {v > 0 ? fmt(v) : '—'}
                            </button>
                          )}
                        </td>
                      )
                    })}
                    <td className="py-1.5 px-4 text-right text-white font-semibold">{fmt(rowTotal)}</td>
                    <td className="py-1.5 px-2 text-center">
                      <button
                        onClick={() => handleDeleteConceptoRow(concepto)}
                        title="Eliminar todas las entradas de este concepto"
                        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-xs px-1 py-0.5 rounded hover:bg-gray-700"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {conceptos.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-700 bg-gray-800/30">
                  <td className="py-3 px-4 sticky left-0 bg-gray-800/30 z-10 text-gray-400 font-semibold text-xs uppercase">Total</td>
                  {Array.from({ length: 12 }, (_, i) => {
                    const colTotal = conceptos.reduce((sum, c) => sum + (matriz.get(c)?.get(i + 1) ?? 0), 0)
                    return (
                      <td key={i} className="py-3 px-1 text-center">
                        <span className={`font-semibold ${colTotal > 0 ? 'text-white' : 'text-gray-700'}`}>
                          {colTotal > 0 ? fmt(colTotal) : '—'}
                        </span>
                      </td>
                    )
                  })}
                  <td className="py-3 px-4 text-right text-white font-bold">{fmt(totalGroup)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    )
  }

  // ── Render monthly gasto table block ──────────────────────────────────────
  function renderMensualTabla(
    title: string,
    categoria: CategoriaGasto,
    subset: Gasto[],
    totalGroup: number,
    showLinkedEntity: 'departamento' | 'cliente' | null,
    extraHeaderBtn?: React.ReactNode,
  ) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">{title}</h3>
          <div className="flex items-center gap-2">
            {extraHeaderBtn}
            <button onClick={() => openCreateGasto(categoria)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              + Añadir
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-6 py-3">Concepto</th>
              {showLinkedEntity === 'departamento' && <th className="text-left px-4 py-3">Departamento</th>}
              {showLinkedEntity === 'cliente' && <th className="text-left px-4 py-3">Cliente</th>}
              <th className="text-right px-6 py-3">Valor</th>
              <th className="text-center px-4 py-3">Acc.</th>
            </tr>
          </thead>
          <tbody>
            {subset.length === 0 && (
              <tr><td colSpan={showLinkedEntity ? 4 : 3} className="text-center text-gray-500 py-8 text-sm">Sin entradas este mes</td></tr>
            )}
            {subset.map(g => (
              <tr key={g.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-6 py-3 text-white">
                  <span className="inline-flex items-center gap-1.5 group/concepto">
                    <span>{g.concepto}</span>
                    <button
                      onClick={() => openEditConceptoModal(g.concepto)}
                      title="Editar metadatos del concepto"
                      className="opacity-0 group-hover/concepto:opacity-100 text-gray-500 hover:text-blue-400 transition-all text-xs leading-none"
                    >
                      ✎
                    </button>
                  </span>
                </td>
                {showLinkedEntity === 'departamento' && (
                  <td className="px-4 py-3 text-gray-400 text-xs">{g.departamento?.nombre ?? '—'}</td>
                )}
                {showLinkedEntity === 'cliente' && (
                  <td className="px-4 py-3 text-xs">
                    {g.cliente ? <span className="text-purple-400">{g.cliente.nombre}</span> : <span className="text-gray-600">—</span>}
                  </td>
                )}
                <td className="px-6 py-3 text-right text-red-400 font-medium">{fmt(Number(g.valor))}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => openEditGasto(g)} className="text-gray-400 hover:text-white text-xs px-1.5 py-1 rounded hover:bg-gray-700">✎</button>
                    <button onClick={() => handleDeleteGasto(g.id)} className="text-red-500 hover:text-red-400 text-xs px-1.5 py-1 rounded hover:bg-gray-700">✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {subset.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-800/50">
                <td colSpan={showLinkedEntity ? 2 : 1} className="px-6 py-3 text-gray-400 text-sm font-medium">Total</td>
                <td className="px-6 py-3 text-right text-white font-bold">{fmt(totalGroup)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    )
  }

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
      <div>
        <h2 className="text-2xl font-bold text-white">Costes</h2>
        <p className="text-gray-400 text-sm mt-1">{vistaAnual ? `Año completo ${anio}` : `${MESES[(mes ?? 1) - 1]} ${anio}`}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Gastos Fijos',    value: totalGastosFijos,        color: 'text-orange-400' },
          { label: 'Sueldos',         value: totalSueldos,            color: 'text-blue-400'   },
          { label: 'Comisiones',      value: totalGastosComisiones,   color: 'text-purple-400' },
          { label: 'Departamentos',   value: totalGastosDepartamentos,color: 'text-cyan-400'   },
          { label: 'Clientes',        value: totalGastosClientes,     color: 'text-yellow-400' },
          { label: 'TOTAL',           value: totalCombinado,          color: 'text-red-400', bold: true },
        ].map(({ label, value, color, bold }) => (
          <div key={label} className={`bg-gray-900 border rounded-xl p-4 ${bold ? 'border-gray-600' : 'border-gray-800'}`}>
            <p className="text-gray-400 text-xs font-medium">{label}</p>
            <p className={`text-xl font-bold mt-1 ${color} ${bold ? 'text-2xl' : ''}`}>{fmt(value)}</p>
            {!bold && totalCombinado > 0 && (
              <p className="text-gray-600 text-[10px] mt-0.5">{((value / totalCombinado) * 100).toFixed(1)}% del total</p>
            )}
          </div>
        ))}
      </div>

      {/* Month selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {years.map(y => (
            <button key={y} onClick={() => router.push(vistaAnual ? `/costes?anio=${y}` : `/costes?mes=${mes ?? 1}&anio=${y}`)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${y === anio ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
              {y}
            </button>
          ))}
          <span className="text-gray-600">|</span>
          <button
            onClick={() => router.push(`/costes?anio=${anio}`)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${vistaAnual ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
          >
            Año completo
          </button>
          {MESES_CORTO.map((m, i) => (
            <button key={i} onClick={() => goTo(i + 1, anio)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${!vistaAnual && mes === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── VISTA ANUAL ─────────────────────────────────────────────────── */}
      {vistaAnual && (
        <div className="space-y-6">
          {/* Row 1: Gastos Fijos + Sueldos */}
          {renderAnualMatriz('Gastos Fijos', 'fijo', matrizFijos, totalGastosFijos)}

          {/* Sueldos matrix */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">Sueldos {anio}</h3>
              <p className="text-gray-500 text-xs mt-0.5">Pincha en cualquier celda para editar · coste total por empleado y mes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-800/50">
                    <th className="text-left text-gray-400 font-medium py-2.5 px-4 min-w-[150px] sticky left-0 bg-gray-800/50 z-10">Empleado</th>
                    {MESES_CORTO.map((m, i) => (
                      <th key={m} className="text-center font-medium py-2.5 px-2 min-w-[70px]">
                        <button onClick={() => goTo(i + 1, anio)} className="text-gray-400 hover:text-blue-400 transition-colors w-full">{m}</button>
                      </th>
                    ))}
                    <th className="text-right text-gray-400 font-medium py-2.5 px-4 min-w-[80px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {empAnuales.length === 0 && (
                    <tr><td colSpan={14} className="text-center text-gray-500 py-10">Sin empleados</td></tr>
                  )}
                  {empAnuales.map(([empId, { nombre, meses }]) => {
                    const rowTotal = Array.from(meses.values()).reduce((a: number, v) => a + Number(v ?? 0), 0)
                    return (
                      <tr key={empId} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                        <td className="py-2 px-4 sticky left-0 bg-gray-900 z-10 text-white font-medium">{nombre}</td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const v = meses.get(i + 1)
                          const isEditingSueldo = editingAnnualSueldoCell?.empId === empId && editingAnnualSueldoCell?.mes === i + 1
                          return (
                            <td key={i} className="py-1 px-1 text-center">
                              {isEditingSueldo ? (
                                <input
                                  ref={annualSueldoCellRef}
                                  type="number"
                                  value={annualSueldoCellValue}
                                  onChange={e => setAnnualSueldoCellValue(e.target.value)}
                                  onBlur={() => saveAnnualSueldoCell(empId, i + 1)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') e.currentTarget.blur()
                                    if (e.key === 'Escape') setEditingAnnualSueldoCell(null)
                                  }}
                                  className="w-16 bg-blue-900/40 border border-blue-500 rounded text-center text-white text-xs px-1 py-1 focus:outline-none"
                                />
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingAnnualSueldoCell({ empId, mes: i + 1 })
                                    setAnnualSueldoCellValue(v != null ? String(v) : '')
                                  }}
                                  title={v != null ? 'Clic para editar' : 'Clic para añadir'}
                                  className={`w-full min-w-[60px] py-1 rounded transition-colors text-center ${
                                    v != null
                                      ? 'text-blue-300 font-medium hover:bg-blue-900/20 cursor-pointer'
                                      : 'text-gray-700 hover:bg-gray-800/40 cursor-pointer'
                                  }`}
                                >
                                  {v != null ? fmt(Number(v)) : '—'}
                                </button>
                              )}
                            </td>
                          )
                        })}
                        <td className="py-2 px-4 text-right">
                          <span className={rowTotal > 0 ? 'text-white font-semibold' : 'text-gray-600'}>{rowTotal > 0 ? fmt(rowTotal) : '—'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {empAnuales.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-gray-700 bg-gray-800/30">
                      <td className="py-3 px-4 sticky left-0 bg-gray-800/30 z-10 text-gray-400 font-semibold text-xs uppercase">Total</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const colTotal = empAnuales.reduce((sum, [, { meses: ms }]) => sum + Number(ms.get(i + 1) ?? 0), 0)
                        return (
                          <td key={i} className="py-3 px-1 text-center">
                            <span className={`font-semibold ${colTotal > 0 ? 'text-white' : 'text-gray-700'}`}>
                              {colTotal > 0 ? fmt(colTotal) : '—'}
                            </span>
                          </td>
                        )
                      })}
                      <td className="py-3 px-4 text-right text-white font-bold">{fmt(totalSueldos)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Row 2: Comisiones + Departamentos */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {renderAnualMatriz('Gastos Comisiones', 'comision', matrizComisiones, totalGastosComisiones)}
            {renderAnualMatriz('Gastos Departamentos', 'departamento', matrizDepartamentos, totalGastosDepartamentos)}
          </div>

          {/* Row 3: Gastos Clientes */}
          {renderAnualMatriz('Gastos Clientes', 'cliente', matrizClientes, totalGastosClientes)}
        </div>
      )}

      {/* ── VISTA MENSUAL ────────────────────────────────────────────────── */}
      {!vistaAnual && (
        <div className="space-y-6">
          {/* Row 1: Gastos Fijos + Sueldos */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {renderMensualTabla(
              'Gastos Fijos',
              'fijo',
              gastosFijos,
              totalGastosFijos,
              null,
              <button onClick={handleCopiarMesAnterior} disabled={copying}
                className="text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 transition-colors">
                {copying ? 'Copiando...' : '↩ Copiar mes anterior'}
              </button>
            )}

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

          {/* Row 2: Comisiones + Departamentos */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {renderMensualTabla('Gastos Comisiones', 'comision', gastosComisiones, totalGastosComisiones, 'cliente')}
            {renderMensualTabla('Gastos Departamentos', 'departamento', gastosDepartamentos, totalGastosDepartamentos, 'departamento')}
          </div>

          {/* Row 3: Gastos Clientes */}
          {renderMensualTabla('Gastos Clientes', 'cliente', gastosClientes, totalGastosClientes, 'cliente')}
        </div>
      )}

      {/* Combined total */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">Total costes {vistaAnual ? anio : ''}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            Fijos {fmt(totalGastosFijos)} + Sueldos {fmt(totalSueldos)} + Comisiones {fmt(totalGastosComisiones)} + Deptos {fmt(totalGastosDepartamentos)} + Clientes {fmt(totalGastosClientes)}
          </p>
        </div>
        <p className="text-2xl font-bold text-white">{fmt(totalCombinado)}</p>
      </div>

      {/* Modal: Gasto */}
      {showGastoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">{gastoEditMode ? 'Editar gasto' : 'Añadir gasto'}</h3>
              <button onClick={() => setShowGastoModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={handleGastoSubmit}>
              <div className="p-6 space-y-4">
                {error && <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm">{error}</div>}

                {/* Categoría selector */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Categoría</label>
                  <div className="flex gap-1 flex-wrap">
                    {([
                      { value: 'fijo', label: 'Gasto Fijo' },
                      { value: 'departamento', label: 'Departamento' },
                      { value: 'comision', label: 'Comisión' },
                      { value: 'cliente', label: 'Gasto Cliente' },
                    ] as { value: CategoriaGasto; label: string }[]).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGastoForm(f => ({ ...f, categoria: opt.value, id_departamento: '', id_cliente: '' }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                          gastoForm.categoria === opt.value
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggle: todo el año (solo en creación) */}
                {!gastoEditMode && (
                  <button
                    type="button"
                    onClick={() => setTodoElAnio(v => !v)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      todoElAnio
                        ? 'bg-orange-900/20 border-orange-700/50 text-orange-300'
                        : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <span>Mismo gasto todo el año ({anio})</span>
                    <span className={`w-9 h-5 rounded-full flex items-center transition-colors px-0.5 ${todoElAnio ? 'bg-orange-500' : 'bg-gray-600'}`}>
                      <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${todoElAnio ? 'translate-x-4' : 'translate-x-0'}`} />
                    </span>
                  </button>
                )}
                {todoElAnio && (
                  <p className="text-orange-400/80 text-xs -mt-2 px-1">
                    Se crearán 12 entradas, una por cada mes de {anio}
                  </p>
                )}
                {/* Month picker: only shown in annual view when todoElAnio is off */}
                {vistaAnual && !todoElAnio && !gastoEditMode && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Mes</label>
                    <select value={mesSingle} onChange={e => setMesSingle(parseInt(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-gray-400 text-sm mb-1">Concepto *</label>
                  <input type="text" value={gastoForm.concepto} onChange={e => setGastoForm(f => ({ ...f, concepto: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" autoFocus />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Valor (€) *</label>
                  <input type="number" min="0" step="0.01" value={gastoForm.valor} onChange={e => setGastoForm(f => ({ ...f, valor: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="0" />
                </div>

                {/* Departamento — solo cuando categoría=departamento */}
                {gastoForm.categoria === 'departamento' && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Departamento *</label>
                    <select value={gastoForm.id_departamento} onChange={e => setGastoForm(f => ({ ...f, id_departamento: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      <option value="">Seleccionar...</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                    </select>
                  </div>
                )}

                {/* Cliente — obligatorio para comisión y gasto cliente */}
                {(gastoForm.categoria === 'comision' || gastoForm.categoria === 'cliente') && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">
                      Cliente <span className="text-orange-400">*</span>
                    </label>
                    <select value={gastoForm.id_cliente} onChange={e => setGastoForm(f => ({ ...f, id_cliente: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      <option value="">Selecciona un cliente…</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
                <button type="button" onClick={() => setShowGastoModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {saving ? 'Guardando...' : gastoEditMode ? 'Guardar' : todoElAnio ? `Añadir 12 meses` : 'Añadir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar concepto (metadata para todos los meses) */}
      {editConceptoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h3 className="text-white font-semibold">Editar concepto</h3>
                <p className="text-gray-500 text-xs mt-0.5">Actualiza nombre y categoría para todos los meses del año</p>
              </div>
              <button onClick={() => setEditConceptoModal(null)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-orange-900/20 border border-orange-800/50 rounded-lg px-4 py-2.5 text-orange-300 text-xs">
                Esto actualizará todos los meses del año para este concepto.
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Categoría</label>
                <div className="flex gap-1 flex-wrap">
                  {([
                    { value: 'fijo', label: 'Gasto Fijo' },
                    { value: 'departamento', label: 'Departamento' },
                    { value: 'comision', label: 'Comisión' },
                    { value: 'cliente', label: 'Gasto Cliente' },
                  ] as { value: CategoriaGasto; label: string }[]).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditConceptoForm(f => ({ ...f, categoria: opt.value, id_departamento: '', id_cliente: '' }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        editConceptoForm.categoria === opt.value
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Nombre del concepto *</label>
                <input
                  type="text"
                  value={editConceptoForm.concepto}
                  onChange={e => setEditConceptoForm(f => ({ ...f, concepto: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              {/* Departamento */}
              {editConceptoForm.categoria === 'departamento' && (
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Departamento *</label>
                  <select
                    value={editConceptoForm.id_departamento}
                    onChange={e => setEditConceptoForm(f => ({ ...f, id_departamento: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Seleccionar...</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
              )}

              {/* Cliente */}
              {(editConceptoForm.categoria === 'comision' || editConceptoForm.categoria === 'cliente') && (
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Cliente <span className="text-orange-400">*</span></label>
                  <select
                    value={editConceptoForm.id_cliente}
                    onChange={e => setEditConceptoForm(f => ({ ...f, id_cliente: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Selecciona un cliente…</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setEditConceptoModal(null)}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEditConcepto}
                disabled={savingConcepto || !editConceptoForm.concepto.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {savingConcepto ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
