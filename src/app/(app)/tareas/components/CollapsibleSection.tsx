'use client'

import { useState, type ReactNode } from 'react'

interface Props {
  title: string
  badge?: number
  defaultOpen?: boolean
  actions?: ReactNode
  children: ReactNode
}

export default function CollapsibleSection({ title, badge, defaultOpen = true, actions, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-white font-semibold text-sm min-w-0">
          <span className={`text-gray-500 transition-transform inline-block ${open ? 'rotate-90' : ''}`}>▸</span>
          <span className="truncate">{title}</span>
          {badge !== undefined && <span className="text-gray-500 text-xs font-normal flex-shrink-0">({badge})</span>}
        </button>
        {actions && <div className="flex gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  )
}
