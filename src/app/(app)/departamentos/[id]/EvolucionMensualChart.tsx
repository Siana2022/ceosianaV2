'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface Row {
  mes: number
  ingresosMes: number
  costPersonalMes: number
  gastosMes: number
  resultadoMes: number
}

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

export default function EvolucionMensualChart({ rows }: { rows: Row[] }) {
  const data = rows.map(r => ({
    mes: MESES_CORTO[r.mes - 1],
    Ingresos: r.ingresosMes,
    'Coste Personal': r.costPersonalMes,
    'Gastos Propios': r.gastosMes,
    Resultado: r.resultadoMes,
  }))

  return (
    <div className="px-4 py-6" style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => v === 0 ? '0' : `${(v/1000).toFixed(0)}k`} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
            formatter={(value) => [fmt(Number(value))]}
          />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: '#9ca3af', paddingTop: 12 }} />
          <Bar dataKey="Ingresos" fill="#34d399" radius={[3,3,0,0]} />
          <Bar dataKey="Coste Personal" fill="#fb923c" radius={[3,3,0,0]} />
          <Bar dataKey="Gastos Propios" fill="#f87171" radius={[3,3,0,0]} />
          <Bar dataKey="Resultado" fill="#60a5fa" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
