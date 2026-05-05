'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface Empleado { id: string; nombre: string }
interface Departamento { id: string; nombre: string }
interface DedicRow {
  id_empleado: string
  id_departamento: string
  porcentaje: number
  mes: number
  anio: number
}
interface Assignment { id_departamento: string; porcentaje: number }

interface Props {
  empleados: Empleado[]
  departamentos: Departamento[]
  dedicacion: DedicRow[]
  anio: number
}

function dotColor(total: number) {
  if (total === 0) return 'bg-gray-700'
  if (total === 100) return 'bg-green-500'
  return 'bg-yellow-500'
}

function pctColor(total: number) {
  if (total === 0) return 'text-gray-600'
  if (total === 100) return 'text-green-400'
  return 'text-yellow-400'
}

export default function DedicacionClient({ empleados, departamentos, dedicacion, anio }: Props) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  // Map: `${empId}_${mes}` → [{id_departamento, porcentaje}]
  const [dedicMap, setDedicMap] = useState<Map<string, Assignment[]>>(() => {
    const map = new Map<string, Assignment[]>()
    for (const d of dedicacion) {
      const key = `${d.id_empleado}_${d.mes}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push({ id_departamento: d.id_departamento, porcentaje: d.porcentaje })
    }
    return map
  })

  // Edit modal state
  const [editCell, setEditCell] = useState<{ empId: string; mes: number } | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [saving, setSaving] = useState(false)
  const [copyingForward, setCopyingForward] = useState(false)

  const openCell = (empId: string, mes: number) => {
    const key = `${empId}_${mes}`
    const current = dedicMap.get(key) ?? []
    setAssignments(current.length > 0 ? current.map(a => ({ ...a })) : [{ id_departamento: '', porcentaje: 100 }])
    setEditCell({ empId, mes })
  }

  const addDept = () => setAssignments(a => [...a, { id_departamento: '', porcentaje: 0 }])
  const removeDept = (idx: number) => setAssignments(a => a.filter((_, i) => i !== idx))
  const updateAssignment = (idx: number, field: keyof Assignment, value: string | number) =>
    setAssignments(a => a.map((item, i) => i === idx ? { ...item, [field]: value } : item))

  const total = assignments.reduce((s, a) => s + Number(a.porcentaje || 0), 0)
  const valid = assignments.filter(a => a.id_departamento && Number(a.porcentaje) > 0)

  const saveCell = async () => {
    if (!editCell || valid.length === 0) return
    setSaving(true)
    try {
      const records = valid.map(a => ({
        id_empleado: editCell.empId,
        id_departamento: a.id_departamento,
        porcentaje: Number(a.porcentaje),
        mes: editCell.mes,
        anio,
      }))
      const res = await fetch('/api/dedicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records),
      })
      if (res.ok) {
        const key = `${editCell.empId}_${editCell.mes}`
        setDedicMap(prev => {
          const next = new Map(prev)
          next.set(key, valid.map(a => ({ id_departamento: a.id_departamento, porcentaje: Number(a.porcentaje) })))
          return next
        })
        setEditCell(null)
      }
    } finally { setSaving(false) }
  }

  const copyForward = async () => {
    if (!editCell || valid.length === 0) return
    setCopyingForward(true)
    try {
      const records = Array.from({ length: 12 - editCell.mes + 1 }, (_, i) => editCell.mes + i).flatMap(mes =>
        valid.map(a => ({
          id_empleado: editCell.empId,
          id_departamento: a.id_departamento,
          porcentaje: Number(a.porcentaje),
          mes,
          anio,
        }))
      )
      const res = await fetch('/api/dedicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records),
      })
      if (res.ok) {
        const newMap = new Map(dedicMap)
        for (let mes = editCell.mes; mes <= 12; mes++) {
          newMap.set(`${editCell.empId}_${mes}`, valid.map(a => ({ id_departamento: a.id_departamento, porcentaje: Number(a.porcentaje) })))
        }
        setDedicMap(newMap)
        setEditCell(null)
      }
    } finally { setCopyingForward(false) }
  }

  const editEmp = empleados.find(e => e.id === editCell?.empId)
  const deptNombre = (id: string) => departamentos.find(d => d.id === id)?.nombre ?? id

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Dedicación</h2>
          <p className="text-gray-400 text-sm mt-1">Año {anio} · clic en cualquier celda para editar</p>
        </div>
        {/* Year selector */}
        <div className="flex items-center gap-2">
          {years.map(y => (
            <button
              key={y}
              onClick={() => router.push(`/dedicacion?anio=${y}`)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${y === anio ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left text-gray-400 font-medium py-3 px-4 min-w-[160px] sticky left-0 bg-gray-800/50 z-10">
                  Empleado
                </th>
                {MESES_CORTO.map(m => (
                  <th key={m} className="text-center text-gray-400 font-medium py-3 px-1 min-w-[80px]">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empleados.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center text-gray-500 py-12">Sin empleados</td>
                </tr>
              )}
              {empleados.map(emp => (
                <tr key={emp.id} className="border-b border-gray-800/30 hover:bg-gray-800/10">
                  <td className="py-2 px-4 sticky left-0 bg-gray-900 z-10 text-white font-medium border-r border-gray-800/50">
                    {emp.nombre}
                  </td>
                  {Array.from({ length: 12 }, (_, i) => {
                    const mes = i + 1
                    const key = `${emp.id}_${mes}`
                    const depts = dedicMap.get(key) ?? []
                    const totalPct = depts.reduce((s, d) => s + d.porcentaje, 0)
                    const isEditing = editCell?.empId === emp.id && editCell?.mes === mes

                    return (
                      <td key={i} className="py-1 px-1 text-center">
                        <button
                          onClick={() => openCell(emp.id, mes)}
                          title={depts.length > 0
                            ? depts.map(d => `${deptNombre(d.id_departamento)}: ${d.porcentaje}%`).join(' · ')
                            : 'Sin dedicación — clic para añadir'}
                          className={`w-full rounded-lg py-1.5 px-1 transition-colors text-center ${
                            isEditing
                              ? 'bg-blue-600/20 border border-blue-500/50'
                              : 'hover:bg-gray-800/60 border border-transparent'
                          }`}
                        >
                          {depts.length === 0 ? (
                            <span className="text-gray-700">—</span>
                          ) : (
                            <div className="space-y-0.5">
                              {/* Total % with color */}
                              <div className="flex items-center justify-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor(totalPct)}`} />
                                <span className={`font-mono text-[11px] font-semibold ${pctColor(totalPct)}`}>
                                  {totalPct}%
                                </span>
                              </div>
                              {/* Dept abbreviations */}
                              <div className="flex flex-wrap justify-center gap-0.5">
                                {depts.map(d => (
                                  <span
                                    key={d.id_departamento}
                                    className="text-[9px] text-gray-500 leading-tight truncate max-w-[72px]"
                                  >
                                    {deptNombre(d.id_departamento).substring(0, 8)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />100% asignado</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500" />Asignación parcial</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-700" />Sin asignar</div>
      </div>

      {/* Modal de edición */}
      {editCell && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h3 className="text-white font-semibold">{editEmp?.nombre}</h3>
                <p className="text-gray-400 text-xs mt-0.5">{MESES_CORTO[editCell.mes - 1]} {anio}</p>
              </div>
              <button onClick={() => setEditCell(null)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            {/* Assignments */}
            <div className="p-6 space-y-3">
              {assignments.map((a, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <select
                    value={a.id_departamento}
                    onChange={e => updateAssignment(idx, 'id_departamento', e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Seleccionar departamento…</option>
                    {departamentos.map(d => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={a.porcentaje}
                      onChange={e => updateAssignment(idx, 'porcentaje', parseInt(e.target.value) || 0)}
                      className="w-16 bg-gray-800 border border-gray-700 rounded-lg text-white px-2 py-2 text-sm text-center focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-gray-400 text-sm">%</span>
                  </div>
                  <button
                    onClick={() => removeDept(idx)}
                    className="text-gray-600 hover:text-red-400 transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                onClick={addDept}
                className="text-blue-400 hover:text-blue-300 text-sm transition-colors flex items-center gap-1"
              >
                + Añadir departamento
              </button>

              {/* Total */}
              <div className={`flex items-center justify-between pt-3 border-t ${total === 100 ? 'border-green-900' : total > 100 ? 'border-red-900' : 'border-gray-800'}`}>
                <span className="text-gray-400 text-sm">Total</span>
                <span className={`text-lg font-bold ${total === 100 ? 'text-green-400' : total > 100 ? 'text-red-400' : 'text-yellow-400'}`}>
                  {total}%
                  {total === 100 && <span className="text-sm font-normal ml-1">✓</span>}
                  {total > 100 && <span className="text-sm font-normal ml-1 text-red-400">¡Excede 100%!</span>}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 border-t border-gray-800">
              <button
                onClick={copyForward}
                disabled={copyingForward || valid.length === 0}
                title={`Aplica esta misma dedicación desde ${MESES_CORTO[editCell.mes - 1]} hasta Dic`}
                className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                {copyingForward ? 'Copiando…' : `Copiar ${MESES_CORTO[editCell.mes - 1]}→Dic`}
              </button>
              <button
                onClick={() => setEditCell(null)}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={saveCell}
                disabled={saving || valid.length === 0 || total === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
