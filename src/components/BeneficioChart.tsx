'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface DataPoint {
  mes: string
  beneficio: number
}

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

export default function BeneficioChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-white font-semibold mb-6">Beneficio mensual</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} barCategoryGap="30%" barSize={80}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: 'transparent' }}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563', borderRadius: '8px', color: '#f9fafb' }}
            labelStyle={{ color: '#f9fafb', fontWeight: 'bold' }}
            formatter={(value: unknown) => fmt(value as number)}
          />
          <Bar dataKey="beneficio" name="Beneficio" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.beneficio >= 0 ? '#22c55e' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
