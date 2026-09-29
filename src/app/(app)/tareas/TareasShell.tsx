'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { TareasProvider, useTareas } from './store'
import type { Cliente, Departamento, Empleado, Plantilla, Proceso, Servicio, Tarea } from './types'

const BASE_TABS = [
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

function ShellInner({ children, isAdmin }: { children: ReactNode; isAdmin: boolean }) {
  const pathname = usePathname()
  const tabs = isAdmin
    ? [...BASE_TABS, { href: '/tareas/en-vivo', label: '🟢 En vivo' }]
    : BASE_TABS
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Tareas</h1>
        <p className="text-gray-500 text-sm">
          Gestión de tareas, reuniones y procesos por cliente. Los datos se guardan en la base de datos.
        </p>
      </div>

      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
        {tabs.map(tab => (
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
  initialTareas: Tarea[]
  initialProcesos: Proceso[]
  initialPlantillas: Plantilla[]
  initialSlackCliente?: Record<string, string>
  isAdmin: boolean
}

export default function TareasShell({
  children,
  initialClientes,
  initialEmpleados,
  initialDepartamentos,
  initialServicios,
  initialTareas,
  initialProcesos,
  initialPlantillas,
  initialSlackCliente,
  isAdmin,
}: TareasShellProps) {
  return (
    <TareasProvider
      initialClientes={initialClientes}
      initialEmpleados={initialEmpleados}
      initialDepartamentos={initialDepartamentos}
      initialServicios={initialServicios}
      initialTareas={initialTareas}
      initialProcesos={initialProcesos}
      initialPlantillas={initialPlantillas}
      initialSlackCliente={initialSlackCliente}
    >
      <ShellInner isAdmin={isAdmin}>{children}</ShellInner>
    </TareasProvider>
  )
}
