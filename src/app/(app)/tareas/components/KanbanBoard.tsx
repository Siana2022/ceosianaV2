'use client'

import { useState } from 'react'
import { useTareas } from '../store'
import type { Proceso } from '../types'
import FaseCard from './FaseCard'
import FaseDetailModal from './FaseDetailModal'
import AgregarFaseModal from './AgregarFaseModal'

export default function KanbanBoard({ proceso }: { proceso: Proceso }) {
  const { actions } = useTareas()
  const [faseAbiertaId, setFaseAbiertaId] = useState<string | null>(null)
  const [mostrarAgregarFase, setMostrarAgregarFase] = useState(false)
  const fases = [...proceso.fases].sort((a, b) => a.orden - b.orden)
  const faseAbierta = fases.find(f => f.id === faseAbiertaId) ?? null

  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">{proceso.nombre}</h3>
        <span className="text-gray-500 text-xs">{actions.nombreCliente(proceso.idCliente)}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {fases.map((f, idx) => (
          <FaseCard
            key={f.id}
            proceso={proceso}
            fase={f}
            onAbrir={() => setFaseAbiertaId(f.id)}
            esPrimera={idx === 0}
            esUltima={idx === fases.length - 1}
          />
        ))}
        <button
          onClick={() => setMostrarAgregarFase(true)}
          className="w-48 flex-shrink-0 border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          <span className="text-lg">+</span>
          Añadir fase
        </button>
      </div>
      {faseAbierta && <FaseDetailModal proceso={proceso} fase={faseAbierta} onClose={() => setFaseAbiertaId(null)} />}
      {mostrarAgregarFase && <AgregarFaseModal proceso={proceso} onClose={() => setMostrarAgregarFase(false)} />}
    </div>
  )
}
