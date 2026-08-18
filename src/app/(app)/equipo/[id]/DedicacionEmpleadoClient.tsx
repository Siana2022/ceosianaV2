'use client'

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface Departamento { id: string; nombre: string }
interface DedicRow { id_departamento: string; porcentaje: number; mes: number }
interface Assignment { id_departamento: string; porcentaje: number }

interface Props {
  empleadoId: string
  anio: number
  departamentos: Departamento[]
  dedicacion: DedicRow[]
}

function pctColor(v: number) {
  if (v === 0) return 'text-gray-700'
  if (v === 100) return 'text-green-400'
  return 'text-yellow-400'
}

export default function DedicacionEmpleadoClient({ anio, departamentos, dedicacion }: Props) {
  // Map: mes → [{id_departamento, porcentaje}]
  const dedicMap = new Map<number, Assignment[]>()
  for (const d of dedicacion) {
    if (!dedicMap.has(d.mes)) dedicMap.set(d.mes, [])
    dedicMap.get(d.mes)!.push({ id_departamento: d.id_departamento, porcentaje: d.porcentaje })
  }

  const deptName = (id: string) => departamentos.find(d => d.id === id)?.nombre ?? id

  // Build unique departments that have any entry
  const activeDepts = [...new Set(Array.from(dedicMap.values()).flat().map(a => a.id_departamento))]
    .map(id => ({ id, nombre: deptName(id) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div>
          <h3 className="text-white font-semibold">Dedicación por departamento — {anio}</h3>
          <p className="text-gray-500 text-xs mt-0.5">Calculado automáticamente a partir de las horas fichadas cada mes.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-800/50">
              <th className="text-left text-gray-400 font-medium py-2.5 px-4 sticky left-0 bg-gray-800/50 z-10 min-w-[140px]">Mes</th>
              {activeDepts.length > 0
                ? activeDepts.map(d => (
                    <th key={d.id} className="text-center text-gray-400 font-medium py-2.5 px-3 min-w-[80px]">{d.nombre}</th>
                  ))
                : <th className="text-center text-gray-500 font-medium py-2.5 px-3">Sin fichajes</th>
              }
              <th className="text-center text-gray-400 font-medium py-2.5 px-3 min-w-[60px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => {
              const mes = i + 1
              const row = dedicMap.get(mes) ?? []
              const rowTotal = row.reduce((s, a) => s + a.porcentaje, 0)
              return (
                <tr key={mes} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                  <td className="py-2 px-4 sticky left-0 bg-gray-900 z-10 font-medium text-gray-300">
                    {MESES_CORTO[i]}
                  </td>
                  {activeDepts.length > 0
                    ? activeDepts.map(d => {
                        const a = row.find(r => r.id_departamento === d.id)
                        return (
                          <td key={d.id} className="py-2 px-3 text-center">
                            {a ? (
                              <span className={`font-medium ${pctColor(a.porcentaje)}`}>{a.porcentaje}%</span>
                            ) : (
                              <span className="text-gray-700">—</span>
                            )}
                          </td>
                        )
                      })
                    : <td className="py-2 px-3 text-center text-gray-700">—</td>
                  }
                  <td className="py-2 px-3 text-center">
                    <span className={`font-medium ${pctColor(rowTotal)}`}>{rowTotal > 0 ? `${rowTotal}%` : '—'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
