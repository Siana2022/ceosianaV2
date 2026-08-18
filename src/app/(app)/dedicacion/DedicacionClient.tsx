'use client'

import { useRouter } from 'next/navigation'

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface Empleado { id: string; nombre: string }
interface Departamento { id: string; nombre: string }
interface DedicRow {
  id_empleado: string
  id_departamento: string
  porcentaje: number
  mes: number
  anio: number
}
interface Assignment { id_departamento: string; porcentaje: number }

interface Props {
  empleados: Empleado[]
  departamentos: Departamento[]
  dedicacion: DedicRow[]
  anio: number
}

function dotColor(total: number) {
  if (total === 0) return 'bg-gray-700'
  if (total === 100) return 'bg-green-500'
  return 'bg-yellow-500'
}

function pctColor(total: number) {
  if (total === 0) return 'text-gray-600'
  if (total === 100) return 'text-green-400'
  return 'text-yellow-400'
}

export default function DedicacionClient({ empleados, departamentos, dedicacion, anio }: Props) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2023 + 2 }, (_, i) => 2023 + i)

  // Map: `${empId}_${mes}` → [{id_departamento, porcentaje}]
  const dedicMap = new Map<string, Assignment[]>()
  for (const d of dedicacion) {
    const key = `${d.id_empleado}_${d.mes}`
    if (!dedicMap.has(key)) dedicMap.set(key, [])
    dedicMap.get(key)!.push({ id_departamento: d.id_departamento, porcentaje: d.porcentaje })
  }

  const deptNombre = (id: string) => departamentos.find(d => d.id === id)?.nombre ?? id

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Dedicación</h2>
          <p className="text-gray-400 text-sm mt-1">Año {anio} · calculado automáticamente a partir de las horas fichadas cada mes</p>
        </div>
        {/* Year selector */}
        <div className="flex items-center gap-2">
          {years.map(y => (
            <button
              key={y}
              onClick={() => router.push(`/dedicacion?anio=${y}`)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${y === anio ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left text-gray-400 font-medium py-3 px-4 min-w-[160px] sticky left-0 bg-gray-800/50 z-10">
                  Empleado
                </th>
                {MESES_CORTO.map(m => (
                  <th key={m} className="text-center text-gray-400 font-medium py-3 px-1 min-w-[80px]">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empleados.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center text-gray-500 py-12">Sin empleados</td>
                </tr>
              )}
              {empleados.map(emp => (
                <tr key={emp.id} className="border-b border-gray-800/30 hover:bg-gray-800/10">
                  <td className="py-2 px-4 sticky left-0 bg-gray-900 z-10 text-white font-medium border-r border-gray-800/50">
                    {emp.nombre}
                  </td>
                  {Array.from({ length: 12 }, (_, i) => {
                    const mes = i + 1
                    const key = `${emp.id}_${mes}`
                    const depts = dedicMap.get(key) ?? []
                    const totalPct = depts.reduce((s, d) => s + d.porcentaje, 0)

                    return (
                      <td key={i} className="py-1 px-1 text-center">
                        <div
                          title={depts.length > 0
                            ? depts.map(d => `${deptNombre(d.id_departamento)}: ${d.porcentaje}%`).join(' · ')
                            : 'Sin fichajes este mes'}
                          className="w-full rounded-lg py-1.5 px-1 text-center border border-transparent"
                        >
                          {depts.length === 0 ? (
                            <span className="text-gray-700">—</span>
                          ) : (
                            <div className="space-y-0.5 px-0.5">
                              {depts.map(d => (
                                <div key={d.id_departamento} className="flex items-center justify-between gap-1 min-w-0">
                                  <span className="text-[9px] text-gray-500 truncate leading-tight" style={{maxWidth:'46px'}}>
                                    {deptNombre(d.id_departamento).substring(0, 7)}
                                  </span>
                                  <span className={`text-[10px] font-mono font-semibold flex-shrink-0 ${
                                    totalPct === 100 ? 'text-green-400' : 'text-yellow-400'
                                  }`}>{d.porcentaje}%</span>
                                </div>
                              ))}
                              {depts.length > 1 && (
                                <div className="flex items-center justify-center gap-0.5 pt-0.5 border-t border-gray-700/40 mt-0.5">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor(totalPct)}`} />
                                  <span className={`text-[10px] font-mono font-bold ${pctColor(totalPct)}`}>{totalPct}%</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />100% fichado</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500" />Fichaje parcial en varios departamentos</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-700" />Sin fichajes</div>
      </div>
    </div>
  )
}
