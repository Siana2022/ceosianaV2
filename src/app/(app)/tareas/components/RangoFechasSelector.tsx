'use client'

import { finAnio, finMes, finQuincena, hoyISO, inicioAnio, inicioMes, inicioQuincena } from '../dateUtils'

const inputCls = 'bg-gray-800 border border-gray-700 rounded-lg text-white px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500'
const presetBtnCls = 'px-2.5 py-1 rounded text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors'

interface Props {
  desde: string
  hasta: string
  onChange: (desde: string, hasta: string) => void
}

export default function RangoFechasSelector({ desde, hasta, onChange }: Props) {
  const hoy = hoyISO()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        <button onClick={() => onChange(inicioQuincena(hoy), finQuincena(hoy))} className={presetBtnCls}>Quincena</button>
        <button onClick={() => onChange(inicioMes(hoy), finMes(hoy))} className={presetBtnCls}>Mes</button>
        <button onClick={() => onChange(inicioAnio(hoy), finAnio(hoy))} className={presetBtnCls}>Año</button>
      </div>
      <input type="date" value={desde} onChange={e => onChange(e.target.value, hasta)} className={inputCls} />
      <span className="text-gray-600 text-xs">→</span>
      <input type="date" value={hasta} onChange={e => onChange(desde, e.target.value)} className={inputCls} />
    </div>
  )
}
