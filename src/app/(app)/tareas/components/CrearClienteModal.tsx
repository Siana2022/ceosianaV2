'use client'

import { useState } from 'react'
import { useTareas } from '../store'

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

const TIPOS_SUGERIDOS = ['Onboarding cliente', 'Web captación leads', 'Meta Ads', 'SEO', 'Social Media']

export default function CrearClienteModal({ onClose, onCreado }: { onClose: () => void; onCreado: (idCliente: string) => void }) {
  const { actions } = useTareas()
  const [nombre, setNombre] = useState('')
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [tiposExtra, setTiposExtra] = useState<string[]>([])
  const [nuevoTipo, setNuevoTipo] = useState('')

  const todosTipos = [...TIPOS_SUGERIDOS, ...tiposExtra]

  const toggleTipo = (t: string) => setSeleccionados(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const addTipoPersonalizado = () => {
    const t = nuevoTipo.trim()
    if (!t || todosTipos.includes(t)) return
    setTiposExtra(prev => [...prev, t])
    setSeleccionados(prev => [...prev, t])
    setNuevoTipo('')
  }

  const confirmar = () => {
    if (!nombre.trim()) return
    const idCliente = actions.crearCliente(nombre.trim(), seleccionados)
    onCreado(idCliente)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Nuevo cliente</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Nombre del cliente *</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="ej: Panadería El Horno"
              className={inputCls}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirmar()}
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Servicios contratados</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {todosTipos.map(t => {
                const checked = seleccionados.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTipo(t)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${checked ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
                  >
                    {checked ? '✓ ' : ''}{t}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <input
                value={nuevoTipo}
                onChange={e => setNuevoTipo(e.target.value)}
                placeholder="Otro servicio..."
                className={inputCls}
                onKeyDown={e => e.key === 'Enter' && addTipoPersonalizado()}
              />
              <button onClick={addTipoPersonalizado} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 text-sm">+</button>
            </div>
            <p className="text-gray-600 text-xs mt-1">Se usarán para sugerir la plantilla correcta al importar procesos para este cliente.</p>
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm">Cancelar</button>
            <button
              onClick={confirmar}
              disabled={!nombre.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium"
            >
              Crear cliente
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
