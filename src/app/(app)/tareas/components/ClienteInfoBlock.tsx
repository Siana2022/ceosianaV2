'use client'

import { useState } from 'react'
import { useTareas } from '../store'

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

export default function ClienteInfoBlock({ idCliente }: { idCliente: string }) {
  const { state, actions } = useTareas()
  const [nombre, setNombre] = useState('')
  const [url, setUrl] = useState('')

  const enlacesManuales = state.enlacesCliente[idCliente] ?? []
  const procesosCliente = state.procesos.filter(p => p.idCliente === idCliente)
  const tareasCliente = state.tareas.filter(t => t.idCliente === idCliente)

  const enlacesFases = procesosCliente.flatMap(p =>
    p.fases.flatMap(f => f.adjuntos.map(a => ({ ...a, origen: `${p.nombre} · ${f.nombre}` })))
  )
  const enlacesTareas = tareasCliente.flatMap(t => [
    ...t.adjuntos.map(a => ({ ...a, origen: t.nombre })),
    ...(t.enlaceInfo ? [{ id: `info-${t.id}`, nombre: 'Enlace de información', url: t.enlaceInfo, origen: t.nombre }] : []),
  ])
  const enlacesAuto = [...enlacesFases, ...enlacesTareas]

  const addEnlace = () => {
    if (!url.trim()) return
    actions.addEnlaceCliente(idCliente, { nombre: nombre.trim() || 'Enlace', url: url.trim() })
    setNombre('')
    setUrl('')
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <h3 className="text-white font-semibold text-sm">Información del cliente</h3>

      <div>
        <p className="text-gray-400 text-xs mb-2">Enlaces generales (Drive, Looker Studio...)</p>
        <div className="space-y-1.5 mb-2">
          {enlacesManuales.length === 0 && <p className="text-gray-600 text-xs">Sin enlaces todavía.</p>}
          {enlacesManuales.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-1.5">
              <a href={a.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate">
                🔗 {a.nombre}
              </a>
              <button onClick={() => actions.eliminarEnlaceCliente(idCliente, a.id)} className="text-gray-500 hover:text-red-400 text-xs px-2">
                Quitar
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Etiqueta" className={`${inputCls} w-40`} />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            className={inputCls}
            onKeyDown={e => e.key === 'Enter' && addEnlace()}
          />
          <button onClick={addEnlace} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 text-sm">+</button>
        </div>
      </div>

      <div className="border-t border-gray-800 pt-3">
        <p className="text-gray-400 text-xs mb-2">Enlaces de tarjetas y tareas (automático)</p>
        {enlacesAuto.length === 0 ? (
          <p className="text-gray-600 text-xs">Todavía no hay adjuntos en fases ni tareas de este cliente.</p>
        ) : (
          <div className="space-y-1.5">
            {enlacesAuto.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-1.5">
                <a href={a.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate">
                  📎 {a.nombre}
                </a>
                <span className="text-gray-500 text-[11px] flex-shrink-0 ml-2">{a.origen}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
