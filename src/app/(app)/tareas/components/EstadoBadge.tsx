import { ESTADO_FASE_LABEL, ESTADO_TAREA_LABEL } from '../mockData'
import type { EstadoFase, EstadoTarea } from '../types'

const STYLES: Record<EstadoTarea, string> = {
  espera: 'bg-stone-200 text-stone-700',
  proceso: 'bg-blue-100 text-blue-800',
  bloqueada: 'bg-amber-100 text-amber-800',
  terminado: 'bg-green-100 text-green-800',
}

interface Props {
  estado: EstadoFase | EstadoTarea
  // 'fase': la fase todavía no empezada se muestra como "Bloqueada" (por la fase anterior).
  // 'tarea' (por defecto): usa las etiquetas propias de tareas sueltas.
  tipo?: 'fase' | 'tarea'
}

export default function EstadoBadge({ estado, tipo = 'tarea' }: Props) {
  const label = tipo === 'fase' ? ESTADO_FASE_LABEL[estado as EstadoFase] : ESTADO_TAREA_LABEL[estado]
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap flex-shrink-0 ${STYLES[estado]}`}>
      {label}
    </span>
  )
}
