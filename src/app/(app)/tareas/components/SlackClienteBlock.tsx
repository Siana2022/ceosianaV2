'use client'

import { useState } from 'react'
import { useTareas } from '../store'

const inputCls = 'w-64 bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

export default function SlackClienteBlock({ idCliente }: { idCliente: string }) {
  const { state, actions } = useTareas()
  const url = state.slackCliente[idCliente] ?? ''
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(url)

  const guardar = () => {
    actions.setSlackCliente(idCliente, valor.trim())
    setEditando(false)
  }

  const cancelar = () => {
    setValor(url)
    setEditando(false)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h3 className="text-white font-semibold text-sm">💬 Chat de Slack del cliente</h3>
        <p className="text-gray-600 text-xs mt-1">
          {url
            ? 'Canal configurado para este cliente. En producción aquí se embebería el canal en vivo.'
            : 'Todavía no se ha configurado el canal de Slack de este cliente.'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {editando ? (
          <>
            <input
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="https://app.slack.com/client/..."
              className={inputCls}
              onKeyDown={e => e.key === 'Enter' && guardar()}
              autoFocus
            />
            <button onClick={guardar} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-2 text-xs font-medium">Guardar</button>
            <button onClick={cancelar} className="text-gray-500 hover:text-white text-xs px-2">Cancelar</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditando(true)} className="text-gray-400 hover:text-white text-xs px-3 py-2 rounded-lg hover:bg-gray-800">
              {url ? 'Editar enlace' : '+ Configurar enlace'}
            </button>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="bg-[#4A154B] hover:bg-[#611f69] text-white rounded-lg px-4 py-2 text-xs font-medium"
              >
                Abrir chat en Slack ↗
              </a>
            )}
          </>
        )}
      </div>
    </div>
  )
}
