'use client'

import { useState } from 'react'
import { m as motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Plug, Check, Pencil } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { StatusBadge } from './status-badge'
import { useToast } from '@/components/ui/toast'

export interface IntegrationField {
  key: string
  label: string
  value: string
  secret?: boolean
  placeholder?: string
}

export interface IntegrationConfig {
  id: string
  nome: string
  descricao: string
  icon: LucideIcon
  color: string
  status: 'conectado' | 'desconectado' | 'erro'
  fields: IntegrationField[]
}

export function IntegrationCard({ config }: { config: IntegrationConfig }) {
  const { addToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [fields, setFields] = useState(config.fields)
  const [status, setStatus] = useState(config.status)

  const Icon = config.icon

  const handleTest = () => {
    setTesting(true)
    setTimeout(() => {
      setTesting(false)
      setStatus('conectado')
      addToast('success', `${config.nome}: conexao OK`)
    }, 1200)
  }

  const handleSave = () => {
    setEditing(false)
    addToast('success', `${config.nome} salvo`)
  }

  const mask = (v: string) => (v ? '•'.repeat(Math.min(v.length, 18)) : '—')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${config.color}15` }}
        >
          <Icon className="h-5 w-5" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{config.nome}</h3>
            <StatusBadge status={status} dot size="xs" />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{config.descricao}</p>
        </div>
      </div>

      {/* Campos */}
      <div className="space-y-2.5 mb-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">{f.label}</label>
            {editing ? (
              <input
                type="text"
                value={f.value}
                placeholder={f.placeholder}
                onChange={(e) =>
                  setFields((prev) => prev.map((x) => (x.key === f.key ? { ...x, value: e.target.value } : x)))
                }
                className="w-full h-9 mt-1 px-3 rounded-lg text-xs text-white placeholder:text-slate-600 outline-none"
                style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
              />
            ) : (
              <div
                className="flex items-center justify-between h-9 mt-1 px-3 rounded-lg"
                style={{ background: 'rgba(0,0,0,0.2)' }}
              >
                <span className="text-xs text-slate-300 font-mono truncate">
                  {f.secret && !revealed[f.key] ? mask(f.value) : f.value || '—'}
                </span>
                {f.secret && f.value && (
                  <button
                    onClick={() => setRevealed((p) => ({ ...p, [f.key]: !p[f.key] }))}
                    className="text-slate-500 hover:text-slate-300 shrink-0 ml-2"
                  >
                    {revealed[f.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Acoes */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleTest}
          disabled={testing}
          className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-60"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
          {testing ? 'Testando...' : 'Testar conexao'}
        </button>
        {editing ? (
          <button
            onClick={handleSave}
            className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.22)' }}
          >
            <Check className="h-3.5 w-3.5" /> Salvar
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all text-slate-400 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        )}
      </div>
    </motion.div>
  )
}
