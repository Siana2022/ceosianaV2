'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

export default function HistoricoFacturacionChart({
  data,
  yearActivo,
}: {
  data: { anio: number; facturado: number }[]
  yearActivo: number
}) {
  if (data.every(d => d.facturado === 0)) return null

  return (
    <div style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis dataKey="anio" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
            formatter={(value) => [fmt(Number(value)), 'Facturación']}
          />
          <Bar dataKey="facturado" radius={[4, 4, 0, 0]}>
            {data.map(d => (
              <Cell
                key={d.anio}
                fill={d.anio === yearActivo ? '#3b82f6' : '#1d4ed8'}
                opacity={d.anio === yearActivo ? 1 : 0.65}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
