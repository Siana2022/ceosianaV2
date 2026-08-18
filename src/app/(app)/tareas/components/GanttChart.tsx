'use client'

import { addDays, diffDias, formatFecha, hoyISO } from '../dateUtils'

export interface GanttRow {
  id: string
  grupo: string
  label: string
  inicio: string
  fin: string
  color: 'gray' | 'blue' | 'green' | 'red'
  marcador?: boolean
  conflicto?: boolean
  conflictoKey?: string
}

const COLORES: Record<GanttRow['color'], string> = {
  gray: 'bg-gray-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
}

const NOMBRES_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const DAY_WIDTH = 28
const LABEL_WIDTH = 176
const DIAS_FUTURO = 365 // ≈ 12 meses de margen para poder deslizar hacia la derecha

interface Segmento {
  key: string
  label: string
  dias: number
}

interface Props {
  filas: GanttRow[]
  onConflictoClick?: (clave: string) => void
}

export default function GanttChart({ filas, onConflictoClick }: Props) {
  if (filas.length === 0) {
    return (
      <p className="text-gray-600 text-sm bg-gray-900/40 border border-gray-800 rounded-xl p-6 text-center">
        Sin fechas para mostrar en el diagrama.
      </p>
    )
  }

  const minReal = filas.map(f => f.inicio).reduce((a, b) => (a < b ? a : b))
  const maxReal = filas.map(f => f.fin).reduce((a, b) => (a > b ? a : b))
  const inicioRango = addDays(minReal, -7)
  const finRango = addDays(maxReal, DIAS_FUTURO)
  const totalDias = diffDias(inicioRango, finRango) + 1
  const totalWidth = totalDias * DAY_WIDTH
  const hoy = hoyISO()

  const dias: string[] = []
  for (let i = 0; i < totalDias; i++) dias.push(addDays(inicioRango, i))

  const meses: Segmento[] = []
  for (const d of dias) {
    const key = d.slice(0, 7)
    const actual = meses[meses.length - 1]
    if (actual && actual.key === key) {
      actual.dias += 1
    } else {
      meses.push({ key, label: `${NOMBRES_MES[parseInt(d.slice(5, 7), 10) - 1]} ${d.slice(0, 4)}`, dias: 1 })
    }
  }

  const posDias = (iso: string) => diffDias(inicioRango, iso) * DAY_WIDTH
  const posHoy = hoy >= inicioRango && hoy <= finRango ? posDias(hoy) : null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
      <div style={{ width: LABEL_WIDTH + totalWidth, minWidth: '100%' }}>
        {/* Cabecera: meses */}
        <div className="flex sticky top-0 z-20 bg-gray-900">
          <div className="flex-shrink-0 border-b border-gray-800" style={{ width: LABEL_WIDTH }} />
          {meses.map(m => (
            <div
              key={m.key}
              className="flex-shrink-0 text-gray-500 text-[11px] font-medium border-b border-l border-gray-800/70 px-2 py-1.5"
              style={{ width: m.dias * DAY_WIDTH }}
            >
              {m.label}
            </div>
          ))}
        </div>

        {/* Cabecera: días */}
        <div className="flex border-b border-gray-800/80">
          <div className="flex-shrink-0" style={{ width: LABEL_WIDTH }} />
          {dias.map(d => {
            const diaMes = parseInt(d.slice(8, 10), 10)
            return (
              <div
                key={d}
                className="flex-shrink-0 text-gray-600 text-[10px] text-center border-l border-gray-800/30 py-1"
                style={{ width: DAY_WIDTH }}
              >
                {[1, 8, 15, 22, 29].includes(diaMes) ? diaMes : ''}
              </div>
            )
          })}
        </div>

        {/* Filas */}
        <div className="relative">
          {posHoy !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-blue-500/70 z-10"
              style={{ left: LABEL_WIDTH + posHoy + DAY_WIDTH / 2 }}
              title={`Hoy: ${formatFecha(hoy)}`}
            />
          )}
          {filas.map((f, i) => {
            const mostrarGrupo = i === 0 || f.grupo !== filas[i - 1].grupo
            const left = posDias(f.inicio)
            const width = Math.max((diffDias(f.inicio, f.fin) + 1) * DAY_WIDTH, f.marcador ? DAY_WIDTH * 0.6 : DAY_WIDTH)
            const barraCls = f.conflicto
              ? 'bg-amber-500 border-2 border-dashed border-red-400 cursor-pointer'
              : COLORES[f.color]
            return (
              <div key={f.id}>
                {mostrarGrupo && (
                  <div className="flex bg-blue-500/10 border-y border-blue-500/30">
                    <div
                      className="flex-shrink-0 text-blue-300 text-xs font-bold uppercase tracking-wide px-2 py-2 truncate sticky left-0 bg-blue-950 flex items-center gap-1.5"
                      style={{ width: LABEL_WIDTH }}
                    >
                      🏢 {f.grupo}
                    </div>
                    <div style={{ width: totalWidth }} />
                  </div>
                )}
                <div className="flex items-center h-8">
                  <div
                    className="flex-shrink-0 text-xs text-gray-300 truncate px-2 sticky left-0 bg-gray-900"
                    style={{ width: LABEL_WIDTH }}
                    title={f.label}
                  >
                    {f.conflicto && '⚠️ '}{f.label}
                  </div>
                  <div className="relative flex-shrink-0" style={{ width: totalWidth, height: 20 }}>
                    <div
                      className={`absolute top-0.5 h-5 rounded ${f.marcador && !f.conflicto ? 'rounded-full' : ''} ${barraCls}`}
                      style={{ left, width }}
                      title={
                        f.conflicto
                          ? `⚠️ Conflicto de carga: ${formatFecha(f.inicio)} → ${formatFecha(f.fin)} (clic para marcar resuelto)`
                          : `${formatFecha(f.inicio)} → ${formatFecha(f.fin)}`
                      }
                      onClick={f.conflicto && f.conflictoKey ? () => onConflictoClick?.(f.conflictoKey!) : undefined}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
