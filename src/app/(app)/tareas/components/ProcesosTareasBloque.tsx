'use client'

import type { ReactNode } from 'react'
import CollapsibleSection from './CollapsibleSection'
import KanbanBoard from './KanbanBoard'
import TareaCard from './TareaCard'
import TareaListItem from './TareaListItem'
import type { Proceso, Tarea } from '../types'

export type VistaTareas = 'tarjeta' | 'lista'

interface Props {
  procesos: Proceso[]
  procesosVacioTexto?: string
  tareasActivas: Tarea[]
  tareasTerminadas: Tarea[]
  reunionesVisitas: Tarea[]
  vistaTareas: VistaTareas
  onVistaTareasChange: (v: VistaTareas) => void
  onAbrirTarea: (idTarea: string) => void
  onNuevaTarea: () => void
  onNuevaReunionVisita: () => void
  onImportarPlantilla?: () => void
}

// Bloque reutilizado en Vista Global > Cliente / Persona / Departamento: mismos 3 apartados
// (Procesos, Tareas activas, Tareas terminadas) sobre el mismo estado compartido, así lo que se
// cree o cambie desde cualquiera de las 3 vistas queda vinculado en las demás.
export default function ProcesosTareasBloque({
  procesos,
  procesosVacioTexto = 'Sin procesos.',
  tareasActivas,
  tareasTerminadas,
  reunionesVisitas,
  vistaTareas,
  onVistaTareasChange,
  onAbrirTarea,
  onNuevaTarea,
  onNuevaReunionVisita,
  onImportarPlantilla,
}: Props) {
  const vistaToggle = (
    <div className="flex gap-0.5 bg-gray-800 rounded-lg p-0.5 flex-shrink-0">
      <button
        onClick={() => onVistaTareasChange('tarjeta')}
        title="Vista de tarjetas"
        className={`px-2 py-1 rounded text-xs transition-colors ${vistaTareas === 'tarjeta' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
      >
        🗃️
      </button>
      <button
        onClick={() => onVistaTareasChange('lista')}
        title="Vista de lista"
        className={`px-2 py-1 rounded text-xs transition-colors ${vistaTareas === 'lista' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
      >
        📋
      </button>
    </div>
  )

  const renderTareas = (lista: Tarea[], vacioTexto: string) => {
    if (lista.length === 0) {
      return <p className="text-gray-600 text-sm text-center py-4">{vacioTexto}</p>
    }
    if (vistaTareas === 'lista') {
      return <div className="space-y-1.5">{lista.map(t => <TareaListItem key={t.id} tarea={t} onAbrir={() => onAbrirTarea(t.id)} />)}</div>
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {lista.map(t => <TareaCard key={t.id} tarea={t} onAbrir={() => onAbrirTarea(t.id)} />)}
      </div>
    )
  }

  const tareasActivasActions: ReactNode = (
    <div className="flex items-center gap-2">
      {vistaToggle}
      <button onClick={onNuevaTarea} className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
        + Nueva tarea
      </button>
    </div>
  )

  const reunionesVisitasActions: ReactNode = (
    <button onClick={onNuevaReunionVisita} className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
      + Nueva reunión/visita
    </button>
  )

  return (
    <div className="space-y-3">
      <CollapsibleSection
        title="Procesos"
        badge={procesos.length}
        defaultOpen
        actions={
          onImportarPlantilla && (
            <button onClick={onImportarPlantilla} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
              + Importar plantilla
            </button>
          )
        }
      >
        {procesos.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-4">{procesosVacioTexto}</p>
        ) : (
          procesos.map(p => <KanbanBoard key={p.id} proceso={p} />)
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Tareas activas" badge={tareasActivas.length} defaultOpen actions={tareasActivasActions}>
        {renderTareas(tareasActivas, 'Sin tareas activas.')}
      </CollapsibleSection>

      <CollapsibleSection title="🤝 Reuniones y visitas" badge={reunionesVisitas.length} defaultOpen actions={reunionesVisitasActions}>
        {renderTareas(reunionesVisitas, 'Sin reuniones ni visitas programadas.')}
      </CollapsibleSection>

      <CollapsibleSection title="Tareas terminadas" badge={tareasTerminadas.length} defaultOpen={false}>
        {renderTareas(tareasTerminadas, 'Todavía no hay tareas terminadas.')}
      </CollapsibleSection>
    </div>
  )
}
