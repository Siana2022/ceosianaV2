export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(iso: string, dias: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Diferencia en días entre dos fechas ISO (hasta - desde).
export function diffDias(desde: string, hasta: string): number {
  const a = new Date(desde)
  const b = new Date(hasta)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// Formatea una fecha ISO (YYYY-MM-DD) como DD/MM/AAAA para mostrarla en tarjetas y detalles.
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

// ¿Se solapan (aunque sea un día) los rangos [aIni,aFin] y [bIni,bFin]?
export function overlap(aIni: string, aFin: string, bIni: string, bFin: string): boolean {
  return aIni <= bFin && bIni <= aFin
}

export function inicioMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function finMes(iso: string): string {
  const [y, m] = iso.slice(0, 7).split('-').map(Number)
  const ultimoDia = new Date(y, m, 0).getDate()
  return `${iso.slice(0, 7)}-${String(ultimoDia).padStart(2, '0')}`
}

export function inicioAnio(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`
}

export function finAnio(iso: string): string {
  return `${iso.slice(0, 4)}-12-31`
}

export function inicioQuincena(iso: string): string {
  const dia = parseInt(iso.slice(8, 10), 10)
  return dia <= 15 ? `${iso.slice(0, 7)}-01` : `${iso.slice(0, 7)}-16`
}

export function finQuincena(iso: string): string {
  const dia = parseInt(iso.slice(8, 10), 10)
  return dia <= 15 ? `${iso.slice(0, 7)}-15` : finMes(iso)
}

export type EstadoTiempo = 'en_tiempo' | 'retraso'

// null cuando la fase todavía no ha empezado (estado 'espera') y no aplica juzgar el plazo.
export function calcularEstadoTiempoFase(fase: {
  estado: string
  fechaFinPrevista: string
  fechaCompletado: string | null
}): EstadoTiempo | null {
  if (fase.estado === 'espera') return null
  if (fase.estado === 'terminado') {
    if (!fase.fechaCompletado) return null
    return fase.fechaCompletado <= fase.fechaFinPrevista ? 'en_tiempo' : 'retraso'
  }
  return hoyISO() <= fase.fechaFinPrevista ? 'en_tiempo' : 'retraso'
}
