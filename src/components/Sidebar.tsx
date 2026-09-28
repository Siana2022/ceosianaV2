'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const menuAdmin = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/clientes', label: 'Clientes', icon: '🏢' },
  { href: '/departamentos', label: 'Servicios', icon: '🛠️' },
  { href: '/tareas', label: 'Tareas', icon: '🗂️' },
  { href: '/ingresos', label: 'Ingresos', icon: '💶' },
  { href: '/equipo', label: 'Equipo', icon: '👥' },
  { href: '/comercial', label: 'Comercial', icon: '🎯' },
  { href: '/pipeline', label: 'Pipeline', icon: '🔮' },
  { href: '/dedicacion', label: 'Dedicación', icon: '⏱️' },
  { href: '/costes', label: 'Costes', icon: '💰' },
  { href: '/administracion', label: 'Administración', icon: '🧾' },
  { href: '/historico', label: 'Histórico', icon: '📈' },
  { href: '/fichar', label: 'Fichar', icon: '🕐' },
  { href: '/informes', label: 'Informes', icon: '📋' },
  { href: '/rendimiento', label: 'Rendimiento', icon: '⚡' },
  { href: '/perfil', label: 'Mi perfil', icon: '👤' },
]

const menuEmpleado = [
  { href: '/fichar', label: 'Fichar', icon: '🕐' },
  { href: '/tareas', label: 'Tareas', icon: '🗂️' },
  { href: '/alertas', label: 'Notificaciones', icon: '🔔' },
  { href: '/perfil', label: 'Mi perfil', icon: '👤' },
]

interface Props {
  rol: 'admin' | 'empleado'
}

export default function Sidebar({ rol }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    if (rol === 'admin') {
      fetch('/api/alertas')
        .then(async r => {
          if (!r.ok) return
          const data = await r.json()
          if (Array.isArray(data)) setAlertCount(data.length)
        })
        .catch(() => {})
    } else {
      fetch('/api/notificaciones/count')
        .then(async r => {
          if (!r.ok) return
          const data = await r.json()
          if (typeof data.count === 'number') setAlertCount(data.count)
        })
        .catch(() => {})
    }
  }, [pathname, rol])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const menu = rol === 'empleado' ? menuEmpleado : menuAdmin

  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            CEO<span className="text-blue-500">SIANA</span>
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            {rol === 'empleado' ? 'Control de tiempos' : 'Panel de dirección'}
          </p>
        </div>
        {alertCount > 0 && (
          <Link href="/alertas" className="relative group">
            <span className="text-xl">🔔</span>
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          </Link>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menu.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const showBadge = item.href === '/alertas' && alertCount > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </Link>
          )
        })}

        {rol === 'admin' && alertCount > 0 && (
          <Link
            href="/alertas"
            className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              pathname === '/alertas'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span>🔔</span>
              <span>Alertas</span>
            </div>
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          </Link>
        )}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>🚪</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
