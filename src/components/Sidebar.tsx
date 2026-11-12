'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import NotificacionesPanel from './NotificacionesPanel'

// ── Color palette for client avatars ──────────────────────────
const CLIENT_COLORS = [
  '#4F9CF9', '#7C3AED', '#059669', '#D97706',
  '#DC2626', '#BE185D', '#0891B2', '#16A34A',
  '#9333EA', '#EA580C', '#0D9488', '#6366F1',
]

function clientColor(id: string) {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return CLIENT_COLORS[hash % CLIENT_COLORS.length]
}

function initials(nombre: string) {
  const words = nombre.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return nombre.slice(0, 2).toUpperCase()
}

// ── Menu structure ─────────────────────────────────────────────
type MenuItem = { href: string; label: string; icon: string }

const NAV_SECTIONS: { label: string; items: MenuItem[] }[] = [
  {
    label: 'PRINCIPAL',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: '📊' },
      { href: '/tareas',    label: 'Tareas',     icon: '🗂️' },
      { href: '/fichar',    label: 'Fichar',     icon: '🕐' },
      { href: '/pipeline',  label: 'Pipeline',   icon: '🔮' },
    ],
  },
  {
    label: 'GESTIÓN',
    items: [
      { href: '/comercial',      label: 'Comercial',      icon: '🎯' },
      { href: '/editorial',      label: 'Editorial',      icon: '📅' },
      { href: '/ingresos',       label: 'Ingresos',       icon: '💶' },
      { href: '/costes',         label: 'Costes',         icon: '💰' },
      { href: '/dedicacion',     label: 'Dedicación',     icon: '⏱️' },
      { href: '/administracion', label: 'Administración', icon: '🧾' },
      { href: '/historico',      label: 'Histórico',      icon: '📈' },
    ],
  },
  {
    label: 'EQUIPO',
    items: [
      { href: '/equipo',        label: 'Equipo',       icon: '👥' },
      { href: '/departamentos', label: 'Servicios',    icon: '🛠️' },
      { href: '/rendimiento',   label: 'Rendimiento',  icon: '⚡' },
      { href: '/informes',      label: 'Informes',     icon: '📋' },
    ],
  },
]

const MENU_EMPLEADO: MenuItem[] = [
  { href: '/fichar',  label: 'Fichar',          icon: '🕐' },
  { href: '/tareas',  label: 'Tareas',           icon: '🗂️' },
  { href: '/alertas', label: 'Notificaciones',   icon: '🔔' },
  { href: '/perfil',  label: 'Mi perfil',        icon: '👤' },
]

// ── NavItem ────────────────────────────────────────────────────
function NavItem({
  href, label, icon, isActive, badge,
}: {
  href: string; label: string; icon: string; isActive: boolean; badge?: number
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-all ${
        isActive
          ? 'bg-[#2D2B28] text-white'
          : 'text-[#9B978E] hover:bg-[#242220] hover:text-[#D4D0C8]'
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-blue-500" />
      )}
      <span className="text-[15px] w-5 text-center flex-shrink-0 leading-none">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )
}

// ── Props ──────────────────────────────────────────────────────
export interface ClienteMin { id: string; nombre: string }

interface Props {
  rol: 'admin' | 'empleado'
  clientes?: ClienteMin[]
}

// ── Sidebar ────────────────────────────────────────────────────
export default function Sidebar({ rol, clientes = [] }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [notifCount, setNotifCount] = useState(0)
  const [clientesOpen, setClientesOpen] = useState(true)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      data-theme="dark"
      className="w-[260px] min-h-screen flex-shrink-0 flex flex-col"
      style={{ backgroundColor: '#1C1A17', borderRight: '1px solid #2A2825' }}
    >
      {/* ── Header ── */}
      <div
        className="px-4 py-[14px] flex items-center justify-between"
        style={{ borderBottom: '1px solid #2A2825' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Logo mark */}
          <div className="w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0 bg-blue-600">
            <span className="text-white text-[11px] font-bold leading-none">C</span>
          </div>
          <div className="min-w-0">
            <div className="text-white text-[13px] font-semibold tracking-wide leading-none">
              CEO<span className="text-blue-400">SIANA</span>
            </div>
            <div className="text-[10px] leading-none mt-[4px]" style={{ color: '#8A8480' }}>
              {rol === 'empleado' ? 'Control de tiempos' : 'Panel de dirección'}
            </div>
          </div>
        </div>
        <NotificacionesPanel rol={rol} onCountUpdate={setNotifCount} />
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {rol === 'empleado' ? (
          <div className="space-y-[2px]">
            {MENU_EMPLEADO.map(item => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                badge={item.href === '/alertas' ? notifCount : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Nav sections */}
            {NAV_SECTIONS.map(section => (
              <div key={section.label}>
                <div className="px-3 mb-[6px]">
                  <span className="text-[10px] font-semibold tracking-[0.1em]" style={{ color: '#7A7570' }}>
                    {section.label}
                  </span>
                </div>
                <div className="space-y-[2px]">
                  {section.items.map(item => (
                    <NavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* ── Clientes section ── */}
            {clientes.length > 0 && (
              <div>
                <button
                  onClick={() => setClientesOpen(o => !o)}
                  className="w-full px-3 mb-[6px] flex items-center justify-between group"
                >
                  <span className="text-[10px] font-semibold tracking-[0.1em] transition-colors group-hover:opacity-80" style={{ color: '#7A7570' }}>
                    CLIENTES
                  </span>
                  <span
                    className="text-[8px] transition-transform duration-200"
                    style={{ color: '#7A7570', transform: clientesOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  >
                    ▶
                  </span>
                </button>

                {clientesOpen && (
                  <div className="space-y-[2px]">
                    {clientes.map(c => {
                      const isActive = pathname.startsWith(`/clientes/${c.id}`)
                      const color = clientColor(c.id)
                      return (
                        <Link
                          key={c.id}
                          href={`/clientes/${c.id}`}
                          className={`relative flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-all ${
                            isActive
                              ? 'bg-[#2D2B28] text-white'
                              : 'text-[#9B978E] hover:bg-[#242220] hover:text-[#D4D0C8]'
                          }`}
                        >
                          {isActive && (
                            <span
                              className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r"
                              style={{ backgroundColor: color }}
                            />
                          )}
                          {/* Client color avatar */}
                          <span
                            className="w-5 h-5 rounded-[4px] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 leading-none"
                            style={{ backgroundColor: color }}
                          >
                            {initials(c.nombre)}
                          </span>
                          <span className="flex-1 truncate">{c.nombre}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className="px-2 py-3" style={{ borderTop: '1px solid #2A2825' }}>
        <NavItem
          href="/perfil"
          label="Mi perfil"
          icon="👤"
          isActive={pathname === '/perfil'}
        />
        <button
          onClick={handleLogout}
          className="mt-[2px] w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-all text-[#9B978E] hover:bg-[#242220] hover:text-[#D4D0C8]"
        >
          <span className="text-[15px] w-5 text-center flex-shrink-0 leading-none">🚪</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
