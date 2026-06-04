'use client'

// Mapa central de status -> { label, cor }
// Cobre todos os dominios: cliente, teste, renovacao, problema, conta, integracao
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  // Clientes
  ativo: { label: 'Ativo', color: '#22c55e' },
  expirado: { label: 'Expirado', color: '#ef4444' },
  pendente: { label: 'Pendente', color: '#f59e0b' },
  suspenso: { label: 'Suspenso', color: '#94a3b8' },

  // Testes
  pago: { label: 'Pago', color: '#3b82f6' },
  sem_resposta: { label: 'Aguardando', color: '#f59e0b' },

  // Renovacoes (status operacional derivado)
  vence_hoje: { label: 'Vence hoje', color: '#f59e0b' },
  vence_breve: { label: 'Vence em breve', color: '#eab308' },
  vencido: { label: 'Vencido', color: '#ef4444' },

  // Problemas
  aberto: { label: 'Aberto', color: '#ef4444' },
  em_analise: { label: 'Em analise', color: '#f59e0b' },
  resolvido: { label: 'Resolvido', color: '#22c55e' },

  // Integracoes / paineis
  conectado: { label: 'Conectado', color: '#22c55e' },
  desconectado: { label: 'Desconectado', color: '#64748b' },
  erro: { label: 'Erro', color: '#ef4444' },
}

export type StatusKey = keyof typeof STATUS_MAP | string

export function getStatusConfig(status: string) {
  return STATUS_MAP[status] ?? { label: status, color: '#64748b' }
}

export function StatusBadge({
  status,
  label,
  size = 'sm',
  dot = false,
}: {
  status: string
  label?: string
  size?: 'xs' | 'sm'
  dot?: boolean
}) {
  const cfg = getStatusConfig(status)
  const text = label ?? cfg.label
  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full shrink-0 ${pad}`}
      style={{ background: `${cfg.color}15`, color: cfg.color }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: cfg.color }}
        />
      )}
      {text}
    </span>
  )
}
