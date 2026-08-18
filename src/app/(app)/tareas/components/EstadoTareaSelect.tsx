'use client'

import { useTareas } from '../store'
import { ESTADO_TAREA_LABEL } from '../mockData'
import type { EstadoTarea, Tarea } from '../types'

const ESTILOS: Record<EstadoTarea, string> = {
  espera: 'bg-gray-500/20 text-gray-300',
  proceso: 'bg-blue-500/20 text-blue-400',
  bloqueada: 'bg-red-500/20 text-red-400',
  terminado: 'bg-green-500/20 text-green-400',
}

const ESTADOS: EstadoTarea[] = ['espera', 'proceso', 'bloqueada', 'terminado']

interface Props {
  tarea: Tarea
  onRequiereExplicacion?: () => void
}

export default function EstadoTareaSelect({ tarea, onRequiereExplicacion }: Props) {
  const { actions } = useTareas()

  const handleChange = (nuevoEstado: EstadoTarea) => {
    if (nuevoEstado === tarea.estado) return
    if (nuevoEstado === 'bloqueada') {
      actions.actualizarTarea(tarea.id, { estado: nuevoEstado, explicacionBloqueo: tarea.explicacionBloqueo ?? '' })
      onRequiereExplicacion?.()
    } else {
      actions.actualizarTarea(tarea.id, { estado: nuevoEstado, explicacionBloqueo: null })
    }
  }

  return (
    <select
      value={tarea.estado}
      onClick={e => e.stopPropagation()}
      onChange={e => handleChange(e.target.value as EstadoTarea)}
      className={`text-[11px] font-medium rounded px-1.5 py-0.5 border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer flex-shrink-0 ${ESTILOS[tarea.estado]}`}
    >
      {ESTADOS.map(e => (
        <option key={e} value={e} className="bg-gray-800 text-white">
          {ESTADO_TAREA_LABEL[e]}
        </option>
      ))}
    </select>
  )
}
