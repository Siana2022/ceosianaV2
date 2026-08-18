import { ESTADO_FASE_LABEL, ESTADO_TAREA_LABEL } from '../mockData'
import type { EstadoFase, EstadoTarea } from '../types'

const STYLES: Record<EstadoTarea, string> = {
  espera: 'bg-gray-500/20 text-gray-300',
  proceso: 'bg-blue-500/20 text-blue-400',
  bloqueada: 'bg-red-500/20 text-red-400',
  terminado: 'bg-green-500/20 text-green-400',
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
