'use client'

import { useRouter } from 'next/navigation'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const formatEur = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

interface Cliente { id: string; nombre: string }

interface DatoAno {
  ano: number
  facturacion: number
  coste: number
  margen: number
  margen_pct: number
}

interface Props {
  clientes: Cliente[]
  datosPorAno: DatoAno[]
  clienteSeleccionado: Cliente | null
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-white font-semibold mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {formatEur(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function HistoricoClient({ clientes, datosPorAno, clienteSeleccionado }: Props) {
  const router = useRouter()

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val) router.push(`/historico?cliente=${val}`)
    else router.push('/historico')
  }

  const anoActual = new Date().getFullYear()

  const datosConVariacion = datosPorAno.map((d, i) => {
    const prev = datosPorAno[i - 1]
    return {
      ...d,
      parcial: d.ano === anoActual,
      var_facturacion:
        prev && prev.facturacion > 0
          ? ((d.facturacion - prev.facturacion) / prev.facturacion) * 100
          : null,
    }
  })

  const totalFac = datosPorAno.reduce((s, d) => s + d.facturacion, 0)
  const totalCoste = datosPorAno.reduce((s, d) => s + d.coste, 0)
  const totalMargen = totalFac - totalCoste

  const anosCompletos = datosPorAno.filter(d => d.ano < anoActual)
  const baseParaMejor = anosCompletos.length > 0 ? anosCompletos : datosPorAno
  const mejorAno =
    baseParaMejor.length > 0
      ? baseParaMejor.reduce(
          (best, d) => (d.facturacion > best.facturacion ? d : best),
          baseParaMejor[0]
        )
      : null

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Histórico de cliente</h1>

      {/* Selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <label className="text-gray-400 text-sm block mb-2">Selecciona un cliente</label>
        <select
          value={clienteSeleccionado?.id ?? ''}
          onChange={handleSelect}
          className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">— Elige un cliente —</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {!clienteSeleccionado && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-lg font-medium text-gray-500">
            Selecciona un cliente para ver su evolución histórica
          </p>
          <p className="text-sm mt-1">
            Verás facturación, costes y margen año a año desde que hay datos
          </p>
        </div>
      )}

      {clienteSeleccionado && datosPorAno.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-lg font-medium text-gray-500">Sin datos de facturación para este cliente</p>
          <p className="text-sm mt-1">
            Registra ingresos en la sección de Ingresos para verlos aquí
          </p>
        </div>
      )}

      {clienteSeleccionado && datosPorAno.length > 0 && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm mb-1">Facturación total</p>
              <p className="text-2xl font-bold text-blue-400">{formatEur(totalFac)}</p>
              <p className="text-gray-500 text-xs mt-1">
                {datosPorAno.length} año{datosPorAno.length > 1 ? 's' : ''} de datos
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm mb-1">Coste total</p>
              <p className="text-2xl font-bold text-yellow-400">{formatEur(totalCoste)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm mb-1">Margen acumulado</p>
              <p className={`text-2xl font-bold ${totalMargen >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatEur(totalMargen)}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm mb-1">Mejor año</p>
              <p className="text-2xl font-bold text-purple-400">{mejorAno?.ano ?? '—'}</p>
              {mejorAno && (
                <p className="text-gray-500 text-xs mt-1">{formatEur(mejorAno.facturacion)}</p>
              )}
            </div>
          </div>

          {/* Gráfica */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-6">
              Evolución anual — {clienteSeleccionado.nombre}
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart
                data={datosPorAno}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="ano" tick={{ fill: '#9CA3AF', fontSize: 13 }} />
                <YAxis
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                <Bar dataKey="facturacion" name="Facturación" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="coste" name="Coste" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                <Line
                  dataKey="margen"
                  name="Margen"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 4 }}
                  type="monotone"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Detalle por año</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 font-medium py-2 pr-4">Año</th>
                  <th className="text-right text-gray-400 font-medium py-2 pr-4">Facturación</th>
                  <th className="text-right text-gray-400 font-medium py-2 pr-4">vs anterior</th>
                  <th className="text-right text-gray-400 font-medium py-2 pr-4">Coste</th>
                  <th className="text-right text-gray-400 font-medium py-2 pr-4">Margen</th>
                  <th className="text-right text-gray-400 font-medium py-2">Margen %</th>
                </tr>
              </thead>
              <tbody>
                {datosConVariacion.map(d => (
                  <tr key={d.ano} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="text-white py-3 pr-4 font-semibold text-base">
                      {d.ano}
                      {d.parcial && (
                        <span className="ml-2 text-xs font-normal text-yellow-500 bg-yellow-900/30 border border-yellow-700/40 rounded px-1.5 py-0.5">
                          parcial
                        </span>
                      )}
                    </td>
                    <td className="text-right text-blue-400 py-3 pr-4 font-medium">
                      {formatEur(d.facturacion)}
                    </td>
                    <td className="text-right py-3 pr-4">
                      {d.var_facturacion !== null ? (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            d.var_facturacion >= 0
                              ? 'text-green-400 bg-green-900/30'
                              : 'text-red-400 bg-red-900/30'
                          }`}
                        >
                          {pct(d.var_facturacion)}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-right text-yellow-400 py-3 pr-4">{formatEur(d.coste)}</td>
                    <td
                      className={`text-right py-3 pr-4 font-medium ${
                        d.margen >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {formatEur(d.margen)}
                    </td>
                    <td
                      className={`text-right py-3 ${
                        d.margen_pct >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {d.margen_pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}

                {/* Fila total */}
                <tr className="border-t-2 border-gray-700 bg-gray-800/30">
                  <td className="text-white py-3 pr-4 font-bold">TOTAL</td>
                  <td className="text-right text-blue-400 py-3 pr-4 font-bold">{formatEur(totalFac)}</td>
                  <td></td>
                  <td className="text-right text-yellow-400 py-3 pr-4 font-bold">{formatEur(totalCoste)}</td>
                  <td
                    className={`text-right py-3 pr-4 font-bold ${
                      totalMargen >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatEur(totalMargen)}
                  </td>
                  <td
                    className={`text-right py-3 font-bold ${
                      totalFac > 0 && (totalMargen / totalFac) * 100 >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {totalFac > 0 ? ((totalMargen / totalFac) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
