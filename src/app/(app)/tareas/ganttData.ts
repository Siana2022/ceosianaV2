import type { Proceso, Tarea } from './types'
import type { GanttRow } from './components/GanttChart'

function colorPorEstadoFase(estado: string): GanttRow['color'] {
  if (estado === 'terminado') return 'green'
  if (estado === 'proceso') return 'blue'
  return 'gray'
}

function colorPorEstadoTarea(estado: string): GanttRow['color'] {
  if (estado === 'terminado') return 'green'
  if (estado === 'bloqueada') return 'red'
  if (estado === 'proceso') return 'blue'
  return 'gray'
}

// Las fases de proceso y las tareas sueltas se construyen en dos pasadas separadas; sin esto,
// un mismo grupo (p.ej. el mismo cliente en la vista por persona/departamento) puede acabar
// repetido y separado en el diagrama si hay otro grupo intercalado. Se agrupan y ordenan aquí
// una sola vez para que cada grupo salga siempre en un único bloque contiguo.
function agruparPorGrupo(filas: GanttRow[]): GanttRow[] {
  return [...filas].sort((a, b) => (
    a.grupo === b.grupo ? a.inicio.localeCompare(b.inicio) : a.grupo.localeCompare(b.grupo)
  ))
}

export function filasGanttCliente(procesos: Proceso[], tareas: Tarea[], idCliente: string): GanttRow[] {
  const filasFases: GanttRow[] = procesos
    .filter(p => p.idCliente === idCliente)
    .flatMap(p => [...p.fases].sort((a, b) => a.orden - b.orden).map(f => ({
      id: f.id,
      grupo: p.nombre,
      label: f.nombre,
      inicio: f.fechaInicioPrevista,
      fin: f.fechaFinPrevista,
      color: colorPorEstadoFase(f.estado),
    })))
  const filasTareas: GanttRow[] = tareas
    .filter(t => t.idCliente === idCliente)
    .map(t => ({
      id: t.id,
      grupo: 'Tareas sueltas y recurrentes',
      label: t.nombre,
      inicio: t.fechaLimite,
      fin: t.fechaLimite,
      color: colorPorEstadoTarea(t.estado),
      marcador: true,
    }))
  return agruparPorGrupo([...filasFases, ...filasTareas])
}

export function filasGanttEmpleado(
  procesos: Proceso[],
  tareas: Tarea[],
  idEmpleado: string,
  nombreCliente: (id: string | null) => string
): GanttRow[] {
  const filasFases: GanttRow[] = procesos.flatMap(p =>
    p.fases.filter(f => f.idsResponsables.includes(idEmpleado)).map(f => ({
      id: f.id,
      grupo: nombreCliente(p.idCliente),
      label: f.nombre,
      inicio: f.fechaInicioPrevista,
      fin: f.fechaFinPrevista,
      color: colorPorEstadoFase(f.estado),
    }))
  )
  const filasTareas: GanttRow[] = tareas
    .filter(t => t.idsResponsables.includes(idEmpleado))
    .map(t => ({
      id: t.id,
      grupo: nombreCliente(t.idCliente),
      label: t.nombre,
      inicio: t.fechaLimite,
      fin: t.fechaLimite,
      color: colorPorEstadoTarea(t.estado),
      marcador: true,
    }))
  return agruparPorGrupo([...filasFases, ...filasTareas])
}

export function filasGanttDepartamento(
  procesos: Proceso[],
  tareas: Tarea[],
  idDepartamento: string,
  nombreCliente: (id: string | null) => string
): GanttRow[] {
  const filasFases: GanttRow[] = procesos.flatMap(p =>
    p.fases.filter(f => f.idDepartamento === idDepartamento).map(f => ({
      id: f.id,
      grupo: nombreCliente(p.idCliente),
      label: f.nombre,
      inicio: f.fechaInicioPrevista,
      fin: f.fechaFinPrevista,
      color: colorPorEstadoFase(f.estado),
    }))
  )
  const filasTareas: GanttRow[] = tareas
    .filter(t => t.idDepartamento === idDepartamento)
    .map(t => ({
      id: t.id,
      grupo: nombreCliente(t.idCliente),
      label: t.nombre,
      inicio: t.fechaLimite,
      fin: t.fechaLimite,
      color: colorPorEstadoTarea(t.estado),
      marcador: true,
    }))
  return agruparPorGrupo([...filasFases, ...filasTareas])
}
