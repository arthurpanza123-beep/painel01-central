'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface ActionItem {
  label: string
  icon: LucideIcon
  onClick: () => void
  color?: string
  danger?: boolean
}

// Menu de acoes reutilizavel (dropdown premium).
export function ActionMenu({
  items,
  label = 'Acoes',
  align = 'right',
}: {
  items: ActionItem[]
  label?: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
        style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.22)' }}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className={`absolute z-50 mt-1.5 w-52 rounded-xl p-1.5 ${align === 'right' ? 'right-0' : 'left-0'}`}
            style={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            }}
          >
            {items.map((item, i) => {
              const c = item.danger ? '#ef4444' : item.color ?? '#cbd5e1'
              return (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick() }}
                  className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-xs font-medium transition-colors hover:bg-white/5 text-left"
                  style={{ color: c }}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
