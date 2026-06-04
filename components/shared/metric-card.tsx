'use client'

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

// Card de metrica premium com glow opcional.
// Usado em Dashboard, Financeiro, etc.
export function MetricCard({
  label,
  value,
  icon: Icon,
  color = '#3b82f6',
  prefix = '',
  suffix = '',
  hint,
  glow = true,
}: {
  label: string
  value: string | number
  icon?: LucideIcon
  color?: string
  prefix?: string
  suffix?: string
  hint?: string
  glow?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      {glow && (
        <div
          className="absolute -top-12 -right-12 h-28 w-28 rounded-full opacity-20 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
        />
      )}
      <div className="relative">
        {Icon && (
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center mb-4"
            style={{ background: `${color}15` }}
          >
            <Icon className="h-4.5 w-4.5" style={{ color }} />
          </div>
        )}
        <p
          className="text-2xl font-bold leading-none mb-1.5 tabular-nums"
          style={{ color: '#f8fafc', fontFamily: 'var(--font-display)' }}
        >
          {prefix}{value}{suffix}
        </p>
        <p className="text-xs text-slate-500">{label}</p>
        {hint && <p className="text-[10px] text-slate-600 mt-1">{hint}</p>}
      </div>
    </motion.div>
  )
}
