import type { GanttRow } from './components/GanttChart'

// Solapamiento "real": tocarse en un único día límite (fin de una = inicio de la siguiente) no cuenta,
// para no marcar como conflicto la simple sucesión normal de fases/tareas de una persona.
function seSuperponen(aIni: string, aFin: string, bIni: string, bFin: string): boolean {
  return aIni < bFin && bIni < aFin
}

// Agrupa por solapamiento de fechas (unión de conjuntos) todas las filas de un mismo empleado y marca
// como "conflicto" cualquier grupo con 2 o más elementos, salvo que ya se haya marcado como resuelto.
export function detectarConflictos(filas: GanttRow[], resueltos: Set<string>): GanttRow[] {
  const n = filas.length
  const padre = filas.map((_, i) => i)

  function encontrar(i: number): number {
    if (padre[i] !== i) padre[i] = encontrar(padre[i])
    return padre[i]
  }
  function unir(i: number, j: number) {
    const a = encontrar(i)
    const b = encontrar(j)
    if (a !== b) padre[a] = b
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (seSuperponen(filas[i].inicio, filas[i].fin, filas[j].inicio, filas[j].fin)) unir(i, j)
    }
  }

  const grupos = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const raiz = encontrar(i)
    grupos.set(raiz, [...(grupos.get(raiz) ?? []), i])
  }

  return filas.map((f, i) => {
    const miembros = grupos.get(encontrar(i)) ?? []
    if (miembros.length < 2) return f
    const clave = miembros.map(idx => filas[idx].id).sort().join('|')
    if (resueltos.has(clave)) return f
    return { ...f, conflicto: true, conflictoKey: clave }
  })
}
