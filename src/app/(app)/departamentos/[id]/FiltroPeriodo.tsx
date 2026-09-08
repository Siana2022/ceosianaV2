'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface Props {
  anio: number
  mesDesde: number
  mesHasta: number
}

export default function FiltroPeriodo({ anio, mesDesde, mesHasta }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2023 + 2 }, (_, i) => 2023 + i)

  function navigate(params: { anio?: number; mesDesde?: number; mesHasta?: number }) {
    const next = new URLSearchParams(sp.toString())
    if (params.anio !== undefined) next.set('anio', String(params.anio))
    if (params.mesDesde !== undefined) {
      next.set('mesDesde', String(params.mesDesde))
      // Si mesHasta < nuevo mesDesde, ajustar
      const hasta = params.mesHasta ?? mesHasta
      if (hasta < params.mesDesde) next.set('mesHasta', String(params.mesDesde))
    }
    if (params.mesHasta !== undefined) next.set('mesHasta', String(params.mesHasta))
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Año */}
      <select
        value={anio}
        onChange={e => navigate({ anio: Number(e.target.value) })}
        className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      <span className="text-gray-500 text-sm">De</span>

      <select
        value={mesDesde}
        onChange={e => navigate({ mesDesde: Number(e.target.value) })}
        className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
      >
        {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
      </select>

      <span className="text-gray-500 text-sm">a</span>

      <select
        value={mesHasta}
        onChange={e => navigate({ mesHasta: Number(e.target.value) })}
        className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
      >
        {MESES.map((m, i) => (
          <option key={i + 1} value={i + 1} disabled={i + 1 < mesDesde}>{m}</option>
        ))}
      </select>

      {/* Año completo shortcut */}
      {(mesDesde !== 1 || mesHasta !== 12) && (
        <button
          onClick={() => navigate({ mesDesde: 1, mesHasta: 12 })}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Año completo
        </button>
      )}
    </div>
  )
}
