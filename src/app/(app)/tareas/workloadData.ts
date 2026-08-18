import { overlap } from './dateUtils'
import type { Proceso, Tarea } from './types'

export interface WorkloadItem {
  id: string
  label: string
  minutos: number
  tareas: number
}

function agregar(mapa: Map<string, WorkloadItem>, id: string | null, label: string, minutos: number) {
  const key = id ?? 'sin-asignar'
  const actual = mapa.get(key) ?? { id: key, label, minutos: 0, tareas: 0 }
  actual.minutos += minutos
  actual.tareas += 1
  mapa.set(key, actual)
}

// Si hay varios responsables, cada uno se contabiliza por completo (no se reparte el tiempo entre ellos).
function agregarPorResponsables(mapa: Map<string, WorkloadItem>, ids: string[], nombreEmpleado: (id: string | null) => string, minutos: number) {
  if (ids.length === 0) {
    agregar(mapa, null, 'Sin asignar', minutos)
    return
  }
  ids.forEach(id => agregar(mapa, id, nombreEmpleado(id), minutos))
}

// Carga de trabajo de un cliente, repartida por empleado responsable (fases de sus procesos + sus tareas sueltas).
export function workloadClientePorEmpleado(
  procesos: Proceso[],
  tareas: Tarea[],
  idCliente: string,
  nombreEmpleado: (id: string | null) => string,
  desde: string,
  hasta: string
): WorkloadItem[] {
  const mapa = new Map<string, WorkloadItem>()
  procesos.filter(p => p.idCliente === idCliente).forEach(p => {
    p.fases.forEach(f => {
      if (overlap(f.fechaInicioPrevista, f.fechaFinPrevista, desde, hasta)) {
        agregarPorResponsables(mapa, f.idsResponsables, nombreEmpleado, f.minutosAcumulados)
      }
    })
  })
  tareas.filter(t => t.idCliente === idCliente).forEach(t => {
    if (overlap(t.fechaLimite, t.fechaLimite, desde, hasta)) {
      agregarPorResponsables(mapa, t.idsResponsables, nombreEmpleado, t.minutosAcumulados)
    }
  })
  return Array.from(mapa.values())
}

// Carga de trabajo de un empleado, repartida por cliente (fases donde es responsable + sus tareas sueltas).
export function workloadEmpleadoPorCliente(
  procesos: Proceso[],
  tareas: Tarea[],
  idEmpleado: string,
  nombreCliente: (id: string | null) => string,
  desde: string,
  hasta: string
): WorkloadItem[] {
  const mapa = new Map<string, WorkloadItem>()
  procesos.forEach(p => {
    p.fases.forEach(f => {
      if (f.idsResponsables.includes(idEmpleado) && overlap(f.fechaInicioPrevista, f.fechaFinPrevista, desde, hasta)) {
        agregar(mapa, p.idCliente, nombreCliente(p.idCliente), f.minutosAcumulados)
      }
    })
  })
  tareas.forEach(t => {
    if (t.idsResponsables.includes(idEmpleado) && overlap(t.fechaLimite, t.fechaLimite, desde, hasta)) {
      agregar(mapa, t.idCliente, t.idCliente ? nombreCliente(t.idCliente) : 'Interna', t.minutosAcumulados)
    }
  })
  return Array.from(mapa.values())
}

// Carga de trabajo de un departamento, repartida por empleado (equilibrio del equipo).
export function workloadDepartamentoPorEmpleado(
  procesos: Proceso[],
  tareas: Tarea[],
  idDepartamento: string,
  nombreEmpleado: (id: string | null) => string,
  desde: string,
  hasta: string
): WorkloadItem[] {
  const mapa = new Map<string, WorkloadItem>()
  procesos.forEach(p => {
    p.fases.forEach(f => {
      if (f.idDepartamento === idDepartamento && overlap(f.fechaInicioPrevista, f.fechaFinPrevista, desde, hasta)) {
        agregarPorResponsables(mapa, f.idsResponsables, nombreEmpleado, f.minutosAcumulados)
      }
    })
  })
  tareas.forEach(t => {
    if (t.idDepartamento === idDepartamento && overlap(t.fechaLimite, t.fechaLimite, desde, hasta)) {
      agregarPorResponsables(mapa, t.idsResponsables, nombreEmpleado, t.minutosAcumulados)
    }
  })
  return Array.from(mapa.values())
}
