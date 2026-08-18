'use client'

import { useState } from 'react'
import { formatFecha } from '../dateUtils'
import type { ChatMensaje, Empleado } from '../types'

interface Props {
  mensajes: ChatMensaje[]
  empleados: Empleado[]
  nombreEmpleado: (id: string | null) => string
  onSend: (texto: string, mencionesIds: string[]) => void
}

export default function ChatMock({ mensajes, empleados, nombreEmpleado, onSend }: Props) {
  const [texto, setTexto] = useState('')
  const [mostrarMenciones, setMostrarMenciones] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [pendientes, setPendientes] = useState<string[]>([])

  const handleChange = (v: string) => {
    setTexto(v)
    const match = v.match(/@([^\s@]*)$/)
    if (match) {
      setMostrarMenciones(true)
      setFiltro(match[1].toLowerCase())
    } else {
      setMostrarMenciones(false)
    }
  }

  const elegirMencion = (emp: Empleado) => {
    setTexto(prev => prev.replace(/@([^\s@]*)$/, `@${emp.nombre} `))
    setPendientes(prev => (prev.includes(emp.id) ? prev : [...prev, emp.id]))
    setMostrarMenciones(false)
  }

  const enviar = () => {
    if (!texto.trim()) return
    onSend(texto.trim(), pendientes)
    setTexto('')
    setPendientes([])
  }

  const sugeridos = empleados.filter(e => e.nombre.toLowerCase().includes(filtro))

  return (
    <div className="space-y-3">
      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
        {mensajes.length === 0 && <p className="text-gray-600 text-xs">Sin mensajes todavía.</p>}
        {mensajes.map(m => (
          <div key={m.id} className="bg-gray-800/60 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500 mb-0.5">{nombreEmpleado(m.autorId)} · {formatFecha(m.fecha)}</p>
            <p className="text-sm text-gray-200 whitespace-pre-wrap">{m.texto}</p>
          </div>
        ))}
      </div>
      <div className="relative">
        {mostrarMenciones && sugeridos.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden w-56 z-10">
            {sugeridos.map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => elegirMencion(e)}
                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
              >
                {e.nombre}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={texto}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && enviar()}
            placeholder="Escribe un mensaje... usa @ para mencionar"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button onClick={enviar} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-2 text-sm font-medium">
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
