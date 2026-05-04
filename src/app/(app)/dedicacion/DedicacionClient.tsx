'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface Empleado { id: string; nombre: string; activo: boolean }
interface Departamento { id: string; nombre: string }

interface DedicacionRow {
  id: string
  id_empleado: string
  id_departamento: string
  porcentaje: number
  mes: number
  anio: number
}

interface Assignment {
  id_departamento: string
  porcentaje: number
}

interface Props {
  empleados: Empleado[]
  departamentos: Departamento[]
  dedicacion: DedicacionRow[]
  mes: number | null
  anio: number
  sinMes: boolean
}

function getDotColor(total: number): string {
  if (total === 0) return 'bg-gray-600'
  if (total === 100) return 'bg-green-500'
  return 'bg-yellow-500'
}

export default function DedicacionClient({ empleados, departamentos, dedicacion, mes, anio, sinMes }: Props) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  const [selectedEmpleado, setSelectedEmpleado] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)

  // Build dedication map per empleado
  const dedicacionByEmpleado = new Map<string, Assignment[]>()
  for (const d of dedicacion) {
    const arr = dedicacionByEmpleado.get(d.id_empleado) ?? []
    arr.push({ id_departamento: d.id_departamento, porcentaje: d.porcentaje })
    dedicacionByEmpleado.set(d.id_empleado, arr)
  }

  const getTotalForEmpleado = (id: string) =>
    (dedicacionByEmpleado.get(id) ?? []).reduce((s, a) => s + Number(a.porcentaje), 0)

  const openEmpleado = (id: string) => {
    setSelectedEmpleado(id)
    const current = dedicacionByEmpleado.get(id) ?? []
    setAssignments(current.length > 0 ? [...current.map(a => ({ ...a }))] : [{ id_departamento: '', porcentaje: 0 }])
  }

  const addDept = () => {
    setAssignments(a => [...a, { id_departamento: '', porcentaje: 0 }])
  }

  const removeAssignment = (idx: number) => {
    setAssignments(a => a.filter((_, i) => i !== idx))
  }

  const updateAssignment = (idx: number, field: keyof Assignment, value: string | number) => {
    setAssignments(a => a.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const total = assignments.reduce((s, a) => s + Number(a.porcentaje || 0), 0)

  const handleSave = async () => {
    if (!selectedEmpleado) return
    const valid = assignments.filter(a => a.id_departamento && Number(a.porcentaje) > 0)
    if (valid.length === 0) return

    setSaving(true)
    try {
      const meses = sinMes ? Array.from({ length: 12 }, (_, i) => i + 1) : [mes!]

      const records = meses.flatMap(m =>
        valid.map(a => ({
          id_empleado: selectedEmpleado,
          id_departamento: a.id_departamento,
          porcentaje: Number(a.porcentaje),
          mes: m,
          anio,
        }))
      )

      const res = await fetch('/api/dedicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records),
      })
      if (!res.ok) { alert('Error al guardar'); return }
      router.refresh()
    } finally { setSaving(false) }
  }

  const handleCopiarAnioAnterior = async () => {
    if (!confirm(`¿Copiar la dedicación de ${anio - 1} a ${anio}?`)) return
    setCopying(true)
    try {
      const res = await fetch(`/api/dedicacion/anio?anio=${anio - 1}`)
      const prevData: DedicacionRow[] = await res.json()
      if (!Array.isArray(prevData) || prevData.length === 0) {
        alert('No hay datos en el año anterior')
        return
      }
      // Copy to all 12 months of current year
      const records = Array.from({ length: 12 }, (_, i) => i + 1).flatMap(m =>
        prevData.map(d => ({
          id_empleado: d.id_empleado,
          id_departamento: d.id_departamento,
          porcentaje: d.porcentaje,
          mes: m,
          anio,
        }))
      )
      const saveRes = await fetch('/api/dedicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records),
      })
      if (!saveRes.ok) { alert('Error al copiar'); return }
      router.refresh()
    } finally { setCopying(false) }
  }

  const selectedEmp = empleados.find(e => e.id === selectedEmpleado)
  const mesLabel = mes ? MESES_CORTO[mes - 1] : 'Todo el año'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Dedicación</h2>
          <p className="text-gray-400 text-sm mt-1">{mesLabel} {anio}</p>
        </div>
        <button
          onClick={handleCopiarAnioAnterior}
          disabled={copying}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {copying ? 'Copiando...' : `↩ Copiar año ${anio - 1}`}
        </button>
      </div>

      {/* Year + Month selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {years.map(y => (
            <button
              key={y}
              onClick={() => router.push(`/dedicacion?anio=${y}${mes ? `&mes=${mes}` : ''}`)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${y === anio ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
            >
              {y}
            </button>
          ))}
          <span className="text-gray-600">|</span>
          <button
            onClick={() => router.push(`/dedicacion?anio=${anio}`)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${sinMes ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
          >
            Todo el año
          </button>
          {MESES_CORTO.map((m, i) => (
            <button
              key={i}
              onClick={() => router.push(`/dedicacion?mes=${i + 1}&anio=${anio}`)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${mes === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Employee list */}
        <div className="xl:col-span-1 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Empleados</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {empleados.map(emp => {
              const t = getTotalForEmpleado(emp.id)
              const isSelected = selectedEmpleado === emp.id
              return (
                <button
                  key={emp.id}
                  onClick={() => openEmpleado(emp.id)}
                  className={`w-full flex items-center justify-between px-6 py-3 text-left transition-colors ${
                    isSelected ? 'bg-blue-600/20 border-l-2 border-blue-500' : 'hover:bg-gray-800/50'
                  } ${!emp.activo ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getDotColor(t)}`} />
                    <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>{emp.nombre}</span>
                    {!emp.activo && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-500 font-medium">inactivo</span>
                    )}
                  </div>
                  <span className={`text-xs font-mono ${t === 100 ? 'text-green-400' : t > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                    {t > 0 ? `${t}%` : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Assignment panel */}
        <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-xl">
          {!selectedEmpleado ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              Selecciona un empleado para editar su dedicación
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <div>
                  <h3 className="text-white font-semibold">{selectedEmp?.nombre}</h3>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {sinMes ? `Guardará los 12 meses de ${anio}` : `${mesLabel} ${anio}`}
                  </p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || total === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>

              <div className="p-6 space-y-3">
                {assignments.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <select
                      value={a.id_departamento}
                      onChange={e => updateAssignment(idx, 'id_departamento', e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Seleccionar departamento...</option>
                      {departamentos.map(d => (
                        <option key={d.id} value={d.id}>{d.nombre}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={a.porcentaje}
                        onChange={e => updateAssignment(idx, 'porcentaje', parseInt(e.target.value) || 0)}
                        className="w-20 bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-right"
                      />
                      <span className="text-gray-400 text-sm">%</span>
                    </div>
                    <button
                      onClick={() => removeAssignment(idx)}
                      className="text-gray-500 hover:text-red-400 transition-colors text-lg w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700"
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
                <div className={`flex items-center justify-between pt-4 border-t border-gray-800 ${
                  total > 100 ? 'border-red-800' : total === 100 ? 'border-green-800' : ''
                }`}>
                  <span className="text-gray-400 text-sm">Total asignado</span>
                  <span className={`text-lg font-bold ${
                    total === 100 ? 'text-green-400' : total > 100 ? 'text-red-400' : total > 0 ? 'text-yellow-400' : 'text-gray-500'
                  }`}>
                    {total}%
                    {total > 100 && <span className="text-sm font-normal ml-2 text-red-400">¡Excede el 100%!</span>}
                    {total === 100 && <span className="text-sm font-normal ml-2 text-green-400">✓</span>}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
