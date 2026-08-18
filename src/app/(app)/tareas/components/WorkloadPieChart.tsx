'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { WorkloadItem } from '../workloadData'

const PALETA = ['#3b82f6', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

interface Props {
  data: WorkloadItem[]
  metrica: 'horas' | 'tareas'
}

export default function WorkloadPieChart({ data, metrica }: Props) {
  const chartData = data
    .map(d => ({
      name: d.label,
      value: metrica === 'horas' ? Math.round((d.minutos / 60) * 10) / 10 : d.tareas,
    }))
    .filter(d => d.value > 0)

  const total = chartData.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    return (
      <p className="text-gray-600 text-sm bg-gray-900/40 border border-gray-800 rounded-xl p-10 text-center">
        Sin datos en el periodo seleccionado.
      </p>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={110}
            paddingAngle={2}
            label={({ name, value }) => `${name}: ${value}${metrica === 'horas' ? 'h' : ''}`}
          >
            {chartData.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} stroke="#111827" />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 12 }}
            formatter={value => [`${value}${metrica === 'horas' ? ' h' : ' tarea(s)'}`, '']}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
