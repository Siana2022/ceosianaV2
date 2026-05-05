'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const menu = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/clientes', label: 'Clientes', icon: '🏢' },
  { href: '/ingresos', label: 'Ingresos', icon: '💶' },
  { href: '/equipo', label: 'Equipo', icon: '👥' },
  { href: '/comercial', label: 'Comercial', icon: '🎯' },
  { href: '/dedicacion', label: 'Dedicación', icon: '⏱️' },
  { href: '/departamentos', label: 'Departamentos', icon: '🗂️' },
  { href: '/costes', label: 'Costes', icon: '💰' },
  { href: '/administracion', label: 'Administración', icon: '🧾' },
  { href: '/historico', label: 'Histórico', icon: '📈' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white tracking-tight">
          CEO<span className="text-blue-500">SIANA</span>
        </h1>
        <p className="text-gray-500 text-xs mt-1">Panel de dirección</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menu.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
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
