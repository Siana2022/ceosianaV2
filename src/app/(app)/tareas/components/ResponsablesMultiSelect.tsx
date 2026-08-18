'use client'

import type { Empleado } from '../types'

interface Props {
  empleados: Empleado[]
  seleccionados: string[]
  onChange: (ids: string[]) => void
}

export default function ResponsablesMultiSelect({ empleados, seleccionados, onChange }: Props) {
  const toggle = (id: string) => {
    onChange(seleccionados.includes(id) ? seleccionados.filter(x => x !== id) : [...seleccionados, id])
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {empleados.map(e => {
        const checked = seleccionados.includes(e.id)
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => toggle(e.id)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${checked ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
          >
            {checked ? '✓ ' : ''}{e.nombre}
          </button>
        )
      })}
    </div>
  )
}
