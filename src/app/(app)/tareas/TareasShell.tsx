'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { TareasProvider, useTareas } from './store'
import type { Cliente, Departamento, Empleado, Servicio } from './types'

const TABS = [
  { href: '/tareas/vista-global', label: '🌐 Vista global' },
  { href: '/tareas/plantillas', label: '📐 Plantillas' },
]

function ToastStack() {
  const { toasts } = useTareas()
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map(t => (
        <div key={t.id} className="bg-gray-900 border border-blue-800/50 text-gray-200 text-sm rounded-lg px-4 py-3 shadow-lg shadow-black/40">
          {t.mensaje}
        </div>
      ))}
    </div>
  )
}

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-white">Procesos</h1>
          <span className="bg-yellow-500/20 text-yellow-400 text-[11px] font-semibold px-2 py-0.5 rounded-full">PROTOTIPO VISUAL</span>
        </div>
        <p className="text-gray-500 text-sm">
          Clientes, equipo y departamentos reales — los procesos y tareas son en memoria y no se guardan en la base de datos.
        </p>
      </div>

      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === tab.href ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {children}
      <ToastStack />
    </div>
  )
}

interface TareasShellProps {
  children: ReactNode
  initialClientes: Cliente[]
  initialEmpleados: Empleado[]
  initialDepartamentos: Departamento[]
  initialServicios: Servicio[]
}

export default function TareasShell({
  children,
  initialClientes,
  initialEmpleados,
  initialDepartamentos,
  initialServicios,
}: TareasShellProps) {
  return (
    <TareasProvider
      initialClientes={initialClientes}
      initialEmpleados={initialEmpleados}
      initialDepartamentos={initialDepartamentos}
      initialServicios={initialServicios}
    >
      <ShellInner>{children}</ShellInner>
    </TareasProvider>
  )
}
