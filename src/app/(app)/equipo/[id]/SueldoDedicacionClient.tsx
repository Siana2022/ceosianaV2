const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

interface Proyecto {
  id: string
  clienteNombre: string
}

interface MesDedicacion {
  mes: number
  sueldo: number
  dedicacionPct: number
  costeDept: number
  proyectos: Proyecto[]
  costePorProyecto: number
  facturacion: number
  rentabilidad: number
}

interface DeptDedicacion {
  deptId: string
  deptNombre: string
  meses: MesDedicacion[]
}

interface Props {
  deptDedicacion: DeptDedicacion[]
  year: number
}

function ProyectosBadges({ proyectos }: { proyectos: Proyecto[] }) {
  const visible = proyectos.slice(0, 3)
  const extra = proyectos.length - 3
  return (
    <div className="flex flex-wrap gap-1 items-center">
      <span className="text-white font-semibold text-sm mr-1">{proyectos.length}</span>
      {visible.map(p => (
        <span key={p.id} className="text-[10px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
          {p.clienteNombre}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
          +{extra} más
        </span>
      )}
    </div>
  )
}

export default function SueldoDedicacionClient({ deptDedicacion, year }: Props) {
  if (deptDedicacion.length === 0) return null

  return (
    <div className="space-y-6">
      <h3 className="text-white font-semibold text-lg">Sueldo por dedicación {year}</h3>

      {deptDedicacion.map(dept => {
        const totalSueldo      = dept.meses.reduce((s, m) => s + m.sueldo, 0)
        const totalCoste       = dept.meses.reduce((s, m) => s + m.costeDept, 0)
        const totalFact        = dept.meses.reduce((s, m) => s + m.facturacion, 0)
        const totalRentab      = dept.meses.reduce((s, m) => s + m.rentabilidad, 0)
        const avgDedicacion    = dept.meses.length > 0
          ? dept.meses.reduce((s, m) => s + m.dedicacionPct, 0) / dept.meses.length
          : 0
        const rentabPct = totalFact > 0 ? (totalRentab / totalFact) * 100 : 0

        const mesByMes = new Map(dept.meses.map(m => [m.mes, m]))

        return (
          <div key={dept.deptId} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <h4 className="text-white font-semibold">{dept.deptNombre}</h4>
                <span className="text-[11px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  {avgDedicacion.toFixed(0)}% dedicación media
                </span>
                <span className={`text-[11px] border px-2 py-0.5 rounded-full ${
                  totalRentab >= 0
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}>
                  {totalRentab >= 0 ? '+' : ''}{fmt(totalRentab)} rentabilidad
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Coste total al depto</p>
                <p className="text-white font-bold">{fmt(totalCoste)}</p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
                    <th className="text-left px-6 py-3">Mes</th>
                    <th className="text-right px-4 py-3">Sueldo</th>
                    <th className="text-right px-4 py-3">Dedicación</th>
                    <th className="text-right px-4 py-3">Coste al depto</th>
                    <th className="text-left px-4 py-3">Proyectos</th>
                    <th className="text-right px-4 py-3">Facturación</th>
                    <th className="text-right px-4 py-3">Rentabilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }, (_, i) => {
                    const mes = i + 1
                    const data = mesByMes.get(mes)
                    if (!data) {
                      return (
                        <tr key={mes} className="border-b border-gray-800/40">
                          <td className="px-6 py-2.5 text-gray-700 font-medium">{MESES[i]}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">—</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">—</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">—</td>
                          <td className="px-4 py-2.5 text-gray-700">—</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">—</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">—</td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={mes} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-6 py-2.5 text-white font-medium">{MESES[i]}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">{fmt(data.sueldo)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-blue-400 font-medium">{data.dedicacionPct}%</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-orange-400">{fmt(data.costeDept)}</td>
                        <td className="px-4 py-2.5">
                          {data.proyectos.length > 0
                            ? <ProyectosBadges proyectos={data.proyectos} />
                            : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {data.facturacion > 0
                            ? <span className="text-white">{fmt(data.facturacion)}</span>
                            : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-medium ${data.rentabilidad >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {fmt(data.rentabilidad)}
                          </span>
                          {data.facturacion > 0 && (
                            <span className={`block text-[11px] ${data.rentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {((data.rentabilidad / data.facturacion) * 100).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-700 bg-gray-800/30">
                    <td className="px-6 py-3 text-gray-400 font-semibold text-xs uppercase tracking-wide">Total anual</td>
                    <td className="px-4 py-3 text-right text-gray-300 font-bold">{fmt(totalSueldo)}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right text-orange-400 font-bold">{fmt(totalCoste)}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right text-white font-bold">{fmt(totalFact)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${totalRentab >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(totalRentab)}
                      </span>
                      {totalFact > 0 && (
                        <span className={`block text-[11px] ${rentabPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {rentabPct.toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
