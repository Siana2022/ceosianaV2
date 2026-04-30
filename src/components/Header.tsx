'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { getCurrentYear, MESES_CORTO } from '@/lib/utils'

export default function Header() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentYear = getCurrentYear()
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

  const activeYear = Number(searchParams.get('year') ?? currentYear)
  const activeMes = searchParams.get('mes') ? Number(searchParams.get('mes')) : null

  function navigate(year: number, mes: number | null) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', String(year))
    if (mes !== null) {
      params.set('mes', String(mes))
    } else {
      params.delete('mes')
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 bg-gray-900 px-6 py-3">
      <div className="flex items-center gap-1">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => navigate(y, activeMes)}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              y === activeYear
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      <div className="mx-2 h-5 w-px bg-gray-700" />

      <div className="flex items-center gap-1">
        <button
          onClick={() => navigate(activeYear, null)}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            activeMes === null
              ? 'bg-blue-500 text-white'
              : 'text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
        >
          Todo el año
        </button>
        {MESES_CORTO.map((mes, idx) => {
          const mesNum = idx + 1
          return (
            <button
              key={mesNum}
              onClick={() => navigate(activeYear, mesNum)}
              className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
                activeMes === mesNum
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {mes}
            </button>
          )
        })}
      </div>
    </div>
  )
}
