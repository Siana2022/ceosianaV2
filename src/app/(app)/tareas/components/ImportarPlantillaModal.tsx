'use client'

import { useState } from 'react'
import { useTareas } from '../store'

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

export default function ImportarPlantillaModal({ idCliente, onClose }: { idCliente: string; onClose: () => void }) {
  const { state, actions } = useTareas()
  const serviciosCliente = state.servicios.filter(s => s.idCliente === idCliente)
  const tiposContratados = new Set(serviciosCliente.map(s => s.tipoServicio))
  const plantillasActivas = state.plantillas.filter(p => p.activo)
  const sugeridas = plantillasActivas.filter(p => p.tipoServicio && tiposContratados.has(p.tipoServicio))
  const otras = plantillasActivas.filter(p => !sugeridas.includes(p))

  const [idPlantilla, setIdPlantilla] = useState(sugeridas[0]?.id ?? plantillasActivas[0]?.id ?? '')
  const [idServicio, setIdServicio] = useState(serviciosCliente[0]?.id ?? '')

  const confirmar = () => {
    if (!idPlantilla) return
    actions.importarPlantilla(idCliente, idServicio || null, idPlantilla)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Importar plantilla</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {plantillasActivas.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay plantillas activas. Créalas primero en la sección Plantillas.</p>
          ) : (
            <>
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">Plantilla</label>
                <select value={idPlantilla} onChange={e => setIdPlantilla(e.target.value)} className={inputCls}>
                  {sugeridas.length > 0 && (
                    <optgroup label="Sugeridas según servicios contratados">
                      {sugeridas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </optgroup>
                  )}
                  {otras.length > 0 && (
                    <optgroup label="Otras plantillas">
                      {otras.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">Servicio contratado</label>
                <select value={idServicio} onChange={e => setIdServicio(e.target.value)} className={inputCls}>
                  <option value="">Sin vincular a un servicio concreto</option>
                  {serviciosCliente.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
                {serviciosCliente.length === 0 && (
                  <p className="text-gray-600 text-xs mt-1">Este cliente no tiene servicios contratados (mock).</p>
                )}
              </div>
            </>
          )}
          <div className="flex gap-3 justify-end pt-1">
            <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm">Cancelar</button>
            <button
              onClick={confirmar}
              disabled={!idPlantilla}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium"
            >
              Importar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
