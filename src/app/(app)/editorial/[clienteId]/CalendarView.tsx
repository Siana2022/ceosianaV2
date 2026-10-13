'use client'

import { useState, useMemo } from 'react'

type Ficha = {
  id: string; id_columna: string; titulo: string | null
  canal: string; fecha_publicacion: string | null; imagen_url: string | null
  copy: string | null; orden: number; id_board: string
}

type Columna = { id: string; nombre: string; color: string; orden: number; id_board: string }

const CANAL_COLOR: Record<string, string> = {
  instagram: '#e1306c',
  facebook: '#1877f2',
  linkedin: '#0a66c2',
  tiktok: '#010101',
  blog: '#f59e0b',
  otro: '#6b7280',
}

const CANAL_EMOJI: Record<string, string> = {
  instagram: '📸', facebook: '📘', linkedin: '💼',
  tiktok: '🎵', blog: '✍️', otro: '🌐',
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  // 0=Sun, convert to Mon-first (0=Mon)
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

export default function CalendarView({
  fichas,
  columnas,
  onEditFicha,
  onAddFicha,
}: {
  fichas: Ficha[]
  columnas: Columna[]
  onEditFicha: (f: Ficha) => void
  onAddFicha: (fecha: string, id_columna: string) => void
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  // Group fichas by day number within the current month
  const fichasByDay = useMemo(() => {
    const map: Record<number, Ficha[]> = {}
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
    for (const f of fichas) {
      if (!f.fecha_publicacion) continue
      if (!f.fecha_publicacion.startsWith(prefix)) continue
      const day = parseInt(f.fecha_publicacion.slice(8, 10))
      if (!map[day]) map[day] = []
      map[day].push(f)
    }
    return map
  }, [fichas, year, month])

  // Max posts in a day (for heat map intensity)
  const maxPosts = useMemo(() => {
    const counts = Object.values(fichasByDay).map(a => a.length)
    return counts.length > 0 ? Math.max(...counts) : 1
  }, [fichasByDay])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null
  const firstColumnaId = columnas[0]?.id ?? ''

  function handleDayClick(dayNum: number) {
    setSelectedDay(prev => prev === dayNum ? null : dayNum)
  }

  function handleAddInDay(e: React.MouseEvent, dayNum: number) {
    e.stopPropagation()
    const fecha = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    onAddFicha(fecha, firstColumnaId)
  }

  const selectedFichas = selectedDay ? (fichasByDay[selectedDay] ?? []) : []
  const colMap = Object.fromEntries(columnas.map(c => [c.id, c]))

  // Stats for the month
  const totalMes = fichas.filter(f => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
    return f.fecha_publicacion?.startsWith(prefix)
  })
  const porCanal = Object.entries(
    totalMes.reduce((acc, f) => { acc[f.canal] = (acc[f.canal] ?? 0) + 1; return acc }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Stats strip */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold text-white">{totalMes.length}</span>
          <span className="text-gray-400 text-sm">posts este mes</span>
        </div>
        {porCanal.map(([canal, count]) => (
          <div key={canal} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-2">
            <span>{CANAL_EMOJI[canal] ?? '🌐'}</span>
            <span className="text-white font-semibold">{count}</span>
            <span className="text-gray-400 text-xs capitalize">{canal}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          <span>Intensidad:</span>
          {[0.15, 0.35, 0.6, 0.85, 1].map((o, i) => (
            <div key={i} className="w-5 h-5 rounded" style={{ background: `rgba(99,102,241,${o})` }} />
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <button onClick={prevMonth} className="text-gray-400 hover:text-white px-3 py-1 rounded-lg hover:bg-gray-800 transition-colors">
            ←
          </button>
          <h2 className="text-white font-semibold text-lg">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="text-gray-400 hover:text-white px-3 py-1 rounded-lg hover:bg-gray-800 transition-colors">
            →
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-800">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }).map((_, i) => {
            const dayNum = i - firstDay + 1
            const isValid = dayNum >= 1 && dayNum <= daysInMonth
            const dayFichas = isValid ? (fichasByDay[dayNum] ?? []) : []
            const count = dayFichas.length
            const isToday = isValid && dayNum === todayDay
            const isSelected = isValid && dayNum === selectedDay

            // Heat map intensity
            const intensity = count > 0 ? Math.max(0.12, (count / maxPosts) * 0.7) : 0

            return (
              <div
                key={i}
                onClick={() => isValid && handleDayClick(dayNum)}
                className={`
                  min-h-[80px] p-2 border-b border-r border-gray-800 transition-all relative group/day
                  ${isValid ? 'cursor-pointer hover:bg-gray-800/60' : 'opacity-0 pointer-events-none'}
                  ${isSelected ? 'ring-2 ring-inset ring-blue-500' : ''}
                `}
                style={count > 0 ? { background: `rgba(99,102,241,${intensity})` } : undefined}
              >
                {isValid && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
                        {dayNum}
                      </div>
                      {/* Botón + visible en hover */}
                      <button
                        onClick={e => handleAddInDay(e, dayNum)}
                        className="opacity-0 group-hover/day:opacity-100 w-5 h-5 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs transition-all"
                        title="Añadir post este día"
                      >
                        +
                      </button>
                    </div>
                    {/* Canal dots */}
                    <div className="flex flex-wrap gap-0.5">
                      {dayFichas.slice(0, 6).map(f => (
                        <div
                          key={f.id}
                          className="w-2 h-2 rounded-full"
                          style={{ background: CANAL_COLOR[f.canal] ?? '#6b7280' }}
                          title={f.titulo ?? f.canal}
                        />
                      ))}
                      {dayFichas.length > 6 && (
                        <span className="text-xs text-gray-400">+{dayFichas.length - 6}</span>
                      )}
                    </div>
                    {count > 0 && (
                      <div className="absolute bottom-1 right-2 text-xs text-gray-300 font-medium">
                        {count}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">
              {selectedDay} de {MONTHS[month]} — {selectedFichas.length} {selectedFichas.length === 1 ? 'post' : 'posts'}
            </h3>
            <button
              onClick={() => handleAddInDay({ stopPropagation: () => {} } as React.MouseEvent, selectedDay!)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              + Añadir post
            </button>
          </div>
          {selectedFichas.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin posts programados para este día.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedFichas.map(f => {
                const col = colMap[f.id_columna]
                return (
                  <div
                    key={f.id}
                    onClick={() => onEditFicha(f)}
                    className="flex items-start gap-4 bg-gray-800 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-blue-500 transition-colors group"
                  >
                    {f.imagen_url && (
                      <img src={f.imagen_url} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{ color: CANAL_COLOR[f.canal] ?? '#6b7280' }}>
                          {CANAL_EMOJI[f.canal] ?? '🌐'}
                        </span>
                        <span className="text-white font-medium text-sm truncate">
                          {f.titulo || <span className="text-gray-500 italic">Sin título</span>}
                        </span>
                      </div>
                      {f.copy && (
                        <p className="text-gray-400 text-xs line-clamp-2">{f.copy}</p>
                      )}
                    </div>
                    {col && (
                      <div
                        className="text-xs px-2 py-1 rounded-full shrink-0 font-medium"
                        style={{ background: col.color + '22', color: col.color }}
                      >
                        {col.nombre}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Posts sin fecha */}
      {(() => {
        const sinFecha = fichas.filter(f => !f.fecha_publicacion)
        if (!sinFecha.length) return null
        return (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
            <h3 className="text-gray-400 font-medium text-sm mb-3">Sin fecha asignada ({sinFecha.length})</h3>
            <div className="flex flex-wrap gap-2">
              {sinFecha.map(f => (
                <div
                  key={f.id}
                  onClick={() => onEditFicha(f)}
                  className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 cursor-pointer hover:border-blue-500 transition-colors text-sm"
                >
                  <span>{CANAL_EMOJI[f.canal] ?? '🌐'}</span>
                  <span className="text-gray-300">{f.titulo || 'Sin título'}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
