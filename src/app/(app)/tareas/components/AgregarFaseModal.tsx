'use client'

import { useState } from 'react'
import { useTareas } from '../store'
import { addDays } from '../dateUtils'
import type { Proceso } from '../types'
import ResponsablesMultiSelect from './ResponsablesMultiSelect'

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

export default function AgregarFaseModal({ proceso, onClose }: { proceso: Proceso; onClose: () => void }) {
  const { state, actions } = useTareas()
  const ultimaFase = [...proceso.fases].sort((a, b) => a.orden - b.orden).at(-1)
  const inicioDefault = ultimaFase?.fechaFinPrevista ?? new Date().toISOString().slice(0, 10)

  const [nombre, setNombre] = useState('')
  const [idDepartamento, setIdDepartamento] = useState('')
  const [idsResponsables, setIdsResponsables] = useState<string[]>([])
  const [fechaInicio, setFechaInicio] = useState(inicioDefault)
  const [fechaFin, setFechaFin] = useState(addDays(inicioDefault, 3))

  const confirmar = () => {
    if (!nombre.trim() || !fechaInicio || !fechaFin) return
    actions.agregarFaseProceso(proceso.id, {
      nombre: nombre.trim(),
      idDepartamento: idDepartamento || null,
      idsResponsables,
      fechaInicioPrevista: fechaInicio,
      fechaFinPrevista: fechaFin,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Añadir fase a &quot;{proceso.nombre}&quot;</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-gray-600 text-xs">
            Útil cuando este proyecto concreto necesita un paso que la plantilla original no tenía.
          </p>
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Nombre de la fase *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej: Revisión legal" className={inputCls} autoFocus />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Departamento</label>
            <select value={idDepartamento} onChange={e => setIdDepartamento(e.target.value)} className={inputCls}>
              <option value="">Sin departamento</option>
              {state.departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Responsables</label>
            <ResponsablesMultiSelect empleados={state.empleados} seleccionados={idsResponsables} onChange={setIdsResponsables} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Fecha inicio prevista</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Fecha fin prevista</label>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm">Cancelar</button>
            <button
              onClick={confirmar}
              disabled={!nombre.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium"
            >
              Añadir fase
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
