'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface Departamento { id: string; nombre: string }
interface DedicRow { id_departamento: string; porcentaje: number; mes: number }
interface Assignment { id_departamento: string; porcentaje: number }

interface Props {
  empleadoId: string
  anio: number
  departamentos: Departamento[]
  dedicacion: DedicRow[]
}

function pctColor(v: number) {
  if (v === 0) return 'text-gray-700'
  if (v === 100) return 'text-green-400'
  return 'text-yellow-400'
}

export default function DedicacionEmpleadoClient({ empleadoId, anio, departamentos, dedicacion }: Props) {
  const router = useRouter()

  // Map: mes → [{id_departamento, porcentaje}]
  const [dedicMap, setDedicMap] = useState<Map<number, Assignment[]>>(() => {
    const map = new Map<number, Assignment[]>()
    for (const d of dedicacion) {
      if (!map.has(d.mes)) map.set(d.mes, [])
      map.get(d.mes)!.push({ id_departamento: d.id_departamento, porcentaje: d.porcentaje })
    }
    return map
  })

  const [editMes, setEditMes] = useState<number | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [saving, setSaving] = useState(false)

  const deptName = (id: string) => departamentos.find(d => d.id === id)?.nombre ?? id

  const openCell = (mes: number) => {
    const current = dedicMap.get(mes) ?? []
    setAssignments(
      current.length > 0
        ? current.map(a => ({ ...a }))
        : [{ id_departamento: '', porcentaje: 100 }]
    )
    setEditMes(mes)
  }

  const total = assignments.reduce((s, a) => s + Number(a.porcentaje || 0), 0)
  const valid = assignments.filter(a => a.id_departamento && Number(a.porcentaje) > 0)

  const saveCell = async () => {
    if (editMes === null) return
    setSaving(true)
    try {
      await fetch('/api/dedicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_empleado: empleadoId,
          mes: editMes,
          anio,
          asignaciones: valid.map(a => ({ id_departamento: a.id_departamento, porcentaje: Number(a.porcentaje) })),
        }),
      })
      setDedicMap(prev => {
        const next = new Map(prev)
        if (valid.length === 0) next.delete(editMes)
        else next.set(editMes, valid.map(a => ({ ...a, porcentaje: Number(a.porcentaje) })))
        return next
      })
      setEditMes(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const copyForward = async () => {
    if (editMes === null) return
    setSaving(true)
    try {
      await Promise.all(
        Array.from({ length: 12 - editMes + 1 }, (_, i) => editMes + i).map(m =>
          fetch('/api/dedicacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_empleado: empleadoId,
              mes: m,
              anio,
              asignaciones: valid.map(a => ({ id_departamento: a.id_departamento, porcentaje: Number(a.porcentaje) })),
            }),
          })
        )
      )
      setDedicMap(prev => {
        const next = new Map(prev)
        for (let m = editMes; m <= 12; m++) {
          if (valid.length === 0) next.delete(m)
          else next.set(m, valid.map(a => ({ ...a, porcentaje: Number(a.porcentaje) })))
        }
        return next
      })
      setEditMes(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // Build unique departments that have any entry
  const activeDepts = [...new Set(Array.from(dedicMap.values()).flat().map(a => a.id_departamento))]
    .map(id => ({ id, nombre: deptName(id) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div>
          <h3 className="text-white font-semibold">Dedicación por departamento — {anio}</h3>
          <p className="text-gray-500 text-xs mt-0.5">Clic en un mes para editar. Cambia aquí o en la página de Dedicación.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-800/50">
              <th className="text-left text-gray-400 font-medium py-2.5 px-4 sticky left-0 bg-gray-800/50 z-10 min-w-[140px]">Mes</th>
              {activeDepts.length > 0
                ? activeDepts.map(d => (
                    <th key={d.id} className="text-center text-gray-400 font-medium py-2.5 px-3 min-w-[80px]">{d.nombre}</th>
                  ))
                : <th className="text-center text-gray-500 font-medium py-2.5 px-3">Sin asignaciones</th>
              }
              <th className="text-center text-gray-400 font-medium py-2.5 px-3 min-w-[60px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => {
              const mes = i + 1
              const row = dedicMap.get(mes) ?? []
              const rowTotal = row.reduce((s, a) => s + a.porcentaje, 0)
              return (
                <tr
                  key={mes}
                  className="border-b border-gray-800/30 hover:bg-gray-800/20 cursor-pointer"
                  onClick={() => openCell(mes)}
                >
                  <td className="py-2 px-4 sticky left-0 bg-gray-900 z-10 font-medium text-gray-300">
                    {MESES_CORTO[i]}
                  </td>
                  {activeDepts.length > 0
                    ? activeDepts.map(d => {
                        const a = row.find(r => r.id_departamento === d.id)
                        return (
                          <td key={d.id} className="py-2 px-3 text-center">
                            {a ? (
                              <span className={`font-medium ${pctColor(a.porcentaje)}`}>{a.porcentaje}%</span>
                            ) : (
                              <span className="text-gray-700">—</span>
                            )}
                          </td>
                        )
                      })
                    : <td className="py-2 px-3 text-center text-gray-700">—</td>
                  }
                  <td className="py-2 px-3 text-center">
                    <span className={`font-medium ${pctColor(rowTotal)}`}>{rowTotal > 0 ? `${rowTotal}%` : '—'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editMes !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">Dedicación — {MESES_CORTO[editMes - 1]} {anio}</h3>
              <button onClick={() => setEditMes(null)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {assignments.map((a, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={a.id_departamento}
                    onChange={e => setAssignments(prev => prev.map((item, i) => i === idx ? { ...item, id_departamento: e.target.value } : item))}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Seleccionar departamento…</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={a.porcentaje}
                    onChange={e => setAssignments(prev => prev.map((item, i) => i === idx ? { ...item, porcentaje: parseInt(e.target.value) || 0 } : item))}
                    className="w-16 bg-gray-800 border border-gray-700 rounded-lg text-white px-2 py-2 text-sm text-center focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-gray-400 text-sm">%</span>
                  <button onClick={() => setAssignments(prev => prev.filter((_, i) => i !== idx))} className="text-gray-600 hover:text-red-400 text-xs px-1">✕</button>
                </div>
              ))}

              <button
                onClick={() => setAssignments(a => [...a, { id_departamento: '', porcentaje: 0 }])}
                className="text-blue-400 hover:text-blue-300 text-xs"
              >
                + Añadir departamento
              </button>

              <div className={`text-xs font-medium mt-1 ${total === 100 ? 'text-green-400' : total > 100 ? 'text-red-400' : 'text-yellow-400'}`}>
                Total: {total}% {total === 100 ? '✓' : total > 100 ? '↑ excede 100%' : ''}
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={copyForward}
                disabled={saving || valid.length === 0}
                className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-lg"
              >
                {saving ? '…' : `Copiar ${MESES_CORTO[editMes - 1]}→Dic`}
              </button>
              <button
                onClick={saveCell}
                disabled={saving || valid.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg font-medium"
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
