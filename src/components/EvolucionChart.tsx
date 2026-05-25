'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DataPoint {
  mes: string
  facturacion: number
  costes: number
}

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

type Vista = 'ambas' | 'facturacion' | 'costes'

export default function EvolucionChart({ data }: { data: DataPoint[] }) {
  const [vista, setVista] = useState<Vista>('ambas')

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h3 className="text-white font-semibold">Evolución mensual</h3>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {([
            { key: 'ambas', label: 'Ambas' },
            { key: 'facturacion', label: 'Facturación' },
            { key: 'costes', label: 'Costes' },
          ] as { key: Vista; label: string }[]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setVista(opt.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                vista === opt.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(value: unknown) => fmt(value as number)}
          />
          <Legend wrapperStyle={{ color: '#9ca3af' }} />
          {(vista === 'ambas' || vista === 'facturacion') && (
            <Line type="monotone" dataKey="facturacion" name="Facturación" stroke="#3b82f6" strokeWidth={2} dot={false} />
          )}
          {(vista === 'ambas' || vista === 'costes') && (
            <Line type="monotone" dataKey="costes" name="Costes" stroke="#f59e0b" strokeWidth={2} dot={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
