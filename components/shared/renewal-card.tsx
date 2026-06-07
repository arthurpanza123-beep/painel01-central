'use client'

import { m as motion } from 'framer-motion'
import { MessageCircle, Phone, Package } from 'lucide-react'
import type { Renovacao } from '@/lib/mock-data'
import { StatusBadge } from './status-badge'
import { ActionMenu, type ActionItem } from './action-menu'

// Deriva o status operacional correto a partir dos dias restantes.
// Regra: nao usar "pendente" como status principal antes do vencimento.
export function statusRenovacao(r: Renovacao): string {
  if (r.status === 'pago') return 'pago'
  if (r.diasRestantes < 0) return 'vencido'
  if (r.diasRestantes === 0) return 'vence_hoje'
  if (r.diasRestantes <= 3) return 'vence_breve'
  return 'ativo'
}

export function RenewalCard({
  renovacao,
  actions,
}: {
  renovacao: Renovacao
  actions: ActionItem[]
}) {
  const status = statusRenovacao(renovacao)
  const pago = status === 'pago'
  const urgente = status === 'vencido' || status === 'vence_hoje'

  const diasLabel =
    pago ? 'Pago' :
    renovacao.diasRestantes < 0 ? `${Math.abs(renovacao.diasRestantes)}d em atraso` :
    renovacao.diasRestantes === 0 ? 'Vence hoje' :
    `${renovacao.diasRestantes}d restantes`

  const diasColor = pago ? '#22c55e' : urgente ? '#ef4444' : renovacao.diasRestantes <= 3 ? '#f59e0b' : '#64748b'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-2xl p-4 transition-all"
      style={{
        background: 'var(--card)',
        border: urgente ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border)',
        opacity: pago ? 0.7 : 1,
      }}
    >
      <div className="flex items-center gap-4">
        {/* Contador de dias */}
        <div className="w-12 text-center shrink-0">
          <p className="text-xl font-bold leading-none tabular-nums" style={{ color: diasColor, fontFamily: 'var(--font-display)' }}>
            {pago ? '✓' : renovacao.diasRestantes < 0 ? '!' : renovacao.diasRestantes}
          </p>
          <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-1">
            {pago ? 'pago' : renovacao.diasRestantes < 0 ? 'atraso' : 'dias'}
          </p>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white truncate">{renovacao.cliente}</h3>
            <StatusBadge status={status} size="xs" />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {renovacao.plano}</span>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {renovacao.telefone}</span>
          </div>
        </div>

        {/* Valor + vencimento */}
        <div className="text-right shrink-0">
          <p className="text-sm font-bold" style={{ color: '#22c55e' }}>R$ {renovacao.valor.toFixed(0)}</p>
          <p className="text-[10px]" style={{ color: diasColor }}>{diasLabel}</p>
        </div>

        {/* Acoes */}
        <ActionMenu items={actions} />
      </div>
    </motion.div>
  )
}
