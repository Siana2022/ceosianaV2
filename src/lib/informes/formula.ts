// Evaluador de fórmulas para métricas calculadas de los informes.
// Soporta + - * / ( ), números y variables. No usa eval.

export type Variables = Record<string, number | null | undefined>

const PRECEDENCIA: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }

function tokenizar(expresion: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < expresion.length) {
    const c = expresion[i]
    if (/\s/.test(c)) { i++; continue }
    if (/[0-9.]/.test(c)) {
      let n = ''
      while (i < expresion.length && /[0-9.]/.test(expresion[i])) n += expresion[i++]
      tokens.push(n)
      continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      let id = ''
      while (i < expresion.length && /[a-zA-Z0-9_]/.test(expresion[i])) id += expresion[i++]
      tokens.push(id)
      continue
    }
    if ('+-*/()'.includes(c)) { tokens.push(c); i++; continue }
    throw new Error(`Carácter no válido: ${c}`)
  }
  return tokens
}

function aRpn(tokens: string[]): string[] {
  const salida: string[] = []
  const pila: string[] = []
  for (const t of tokens) {
    if (/^[0-9.]+$/.test(t) || /^[a-zA-Z_]/.test(t)) { salida.push(t); continue }
    if (t === '(') { pila.push(t); continue }
    if (t === ')') {
      while (pila.length && pila[pila.length - 1] !== '(') salida.push(pila.pop()!)
      if (!pila.length) throw new Error('Paréntesis sin abrir')
      pila.pop()
      continue
    }
    while (pila.length && PRECEDENCIA[pila[pila.length - 1]] >= PRECEDENCIA[t]) salida.push(pila.pop()!)
    pila.push(t)
  }
  while (pila.length) {
    const op = pila.pop()!
    if (op === '(') throw new Error('Paréntesis sin cerrar')
    salida.push(op)
  }
  return salida
}

/** Devuelve null si falta alguna variable o hay división por cero. */
export function evaluarFormula(expresion: string, vars: Variables): number | null {
  try {
    const rpn = aRpn(tokenizar(expresion))
    const pila: number[] = []
    for (const t of rpn) {
      if (/^[0-9.]+$/.test(t)) { pila.push(Number(t)); continue }
      if (/^[a-zA-Z_]/.test(t)) {
        const v = vars[t]
        if (v === null || v === undefined || Number.isNaN(Number(v))) return null
        pila.push(Number(v))
        continue
      }
      const b = pila.pop()
      const a = pila.pop()
      if (a === undefined || b === undefined) return null
      if (t === '+') pila.push(a + b)
      else if (t === '-') pila.push(a - b)
      else if (t === '*') pila.push(a * b)
      else {
        if (b === 0) return null
        pila.push(a / b)
      }
    }
    const r = pila.pop()
    return r === undefined || Number.isNaN(r) ? null : r
  } catch {
    return null
  }
}

/** Variables disponibles para las fórmulas, con nombres en español. */
export function variablesDeFila(fila: Record<string, unknown>): Variables {
  return {
    inversion: Number(fila.coste ?? 0),
    conversiones: Number(fila.conversiones ?? 0),
    cpa: fila.cpa == null ? null : Number(fila.cpa),
    roas: fila.roas == null ? null : Number(fila.roas),
    clics: Number(fila.clics ?? 0),
    impresiones: Number(fila.impresiones ?? 0),
    ctr: fila.ctr == null ? null : Number(fila.ctr),
    valor: Number(fila.valor ?? 0),
  }
}
