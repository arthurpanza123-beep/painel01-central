'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, CalendarClock, Copy, RefreshCw, Eye, DollarSign,
} from 'lucide-react'
import {
  MOCK_RENOVACOES,
  type Renovacao,
  type StatusRenovacao,
} from '@/lib/mock-data'
import { RenewalCard, statusRenovacao } from '@/components/shared/renewal-card'
import { type ActionItem } from '@/components/shared/action-menu'
import { useToast } from '@/components/ui/toast'

type GrupoId = 'vencidas' | 'hoje' | 'semana' | 'depois' | 'pagas'

const GRUPOS: { id: GrupoId; label: string; color: string }[] = [
  { id: 'vencidas', label: 'Vencidas',          color: '#ef4444' },
  { id: 'hoje',     label: 'Vencem hoje',       color: '#f97316' },
  { id: 'semana',   label: 'Proximos 7 dias',   color: '#eab308' },
  { id: 'depois',   label: 'Mais tarde',        color: '#60a5fa' },
  { id: 'pagas',    label: 'Pagas recentemente', color: '#22c55e' },
]

function grupoDe(r: Renovacao): GrupoId {
  if (r.status === 'pago') return 'pagas'
  if (r.diasRestantes < 0) return 'vencidas'
  if (r.diasRestantes === 0) return 'hoje'
  if (r.diasRestantes <= 7) return 'semana'
  return 'depois'
}

export function RenovacoesPage() {
  const [renovacoes, setRenovacoes] = useState(MOCK_RENOVACOES)
  const [dataSource, setDataSource] = useState<'mock' | 'supabase'>('mock')
  const { addToast } = useToast()

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch('/api/renewals', { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar renovacoes')
        const payload = await res.json()
        if (!alive) return
        setRenovacoes(Array.isArray(payload.items) ? payload.items : MOCK_RENOVACOES)
        setDataSource(payload.data_source === 'supabase' ? 'supabase' : 'mock')
      } catch {
        if (!alive) return
        setRenovacoes(MOCK_RENOVACOES)
        setDataSource('mock')
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const metricas = {
    vencemHoje: renovacoes.filter((r) => r.diasRestantes === 0).length,
    vencemEm7Dias: renovacoes.filter((r) => r.diasRestantes > 0 && r.diasRestantes <= 7).length,
  }

  const handleMarcarPago = (id: string, nome: string) => {
    setRenovacoes((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'pago' as StatusRenovacao } : r)))
    addToast('success', `${nome} marcado como pago`)
  }

  const copiarCobranca = (r: Renovacao) => {
    navigator.clipboard.writeText(`Ola ${r.cliente}! Renovacao ${r.plano} - R$ ${r.valor}. Vence em ${r.vencimento}.`)
    addToast('success', 'Cobranca copiada')
  }

  const buildActions = (r: Renovacao): ActionItem[] => {
    const pago = r.status === 'pago'
    const items: ActionItem[] = [
      { label: 'Copiar cobranca', icon: Copy, onClick: () => copiarCobranca(r) },
      { label: 'Renovar', icon: RefreshCw, onClick: () => addToast('success', `Renovacao de ${r.cliente} iniciada`), color: '#60a5fa' },
    ]
    if (!pago) items.push({ label: 'Marcar pago', icon: CheckCircle2, onClick: () => handleMarcarPago(r.id, r.cliente), color: '#22c55e' })
    items.push({ label: 'Ver cliente', icon: Eye, onClick: () => addToast('info', `Abrindo ficha de ${r.cliente}`) })
    return items
  }

  const urgentes = renovacoes.filter((r) => statusRenovacao(r) === 'vencido' || statusRenovacao(r) === 'vence_hoje').length
  const valorTotal = renovacoes.filter((r) => r.status !== 'pago').reduce((acc, r) => acc + r.valor, 0)

  const grupos = GRUPOS.map((g) => {
    const itens = renovacoes
      .filter((r) => grupoDe(r) === g.id)
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
    const total = itens.filter((r) => r.status !== 'pago').reduce((acc, r) => acc + r.valor, 0)
    return { ...g, itens, total }
  }).filter((g) => g.itens.length > 0)

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-10 min-h-screen">
      {/* Header */}
      <div className="text-center mb-8 max-w-xl">
        <div className="flex items-center justify-center gap-2 mb-3">
          <CalendarClock className="h-4 w-4" style={{ color: '#f59e0b' }} />
          <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Agenda de cobranca</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>Renovacoes</h1>
        <p className="text-slate-500 text-sm">
          {urgentes} urgentes · R$ {valorTotal.toFixed(0)} a receber
        </p>
      </div>

      {/* KPIs */}
      <div className="flex items-center gap-8 mb-8">
        <div className="text-center">
          <p className="text-3xl font-bold" style={{ color: urgentes > 0 ? '#ef4444' : '#22c55e', fontFamily: 'var(--font-display)' }}>{urgentes}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Urgentes</p>
        </div>
        <div className="h-10 w-px" style={{ background: 'var(--border)' }} />
        <div className="text-center">
          <p className="text-3xl font-bold" style={{ color: '#f59e0b', fontFamily: 'var(--font-display)' }}>{metricas.vencemEm7Dias}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Em 7 dias</p>
        </div>
        <div className="h-10 w-px" style={{ background: 'var(--border)' }} />
        <div className="text-center">
          <p className="text-3xl font-bold" style={{ color: '#22c55e', fontFamily: 'var(--font-display)' }}>R$ {valorTotal.toFixed(0)}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">A receber</p>
        </div>
      </div>

      {/* Agenda agrupada com cards */}
      <div className="w-full max-w-2xl space-y-6">
        {grupos.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color: '#22c55e' }} />
            <p className="text-slate-400 text-sm">Nenhuma renovacao pendente</p>
          </div>
        ) : (
          grupos.map((grupo) => (
            <div key={grupo.id}>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: grupo.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: grupo.color }}>
                    {grupo.label}
                  </span>
                  <span className="text-[10px] text-slate-600">({grupo.itens.length})</span>
                </div>
                {grupo.total > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <DollarSign className="h-3 w-3" /> {grupo.total.toFixed(0)}
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                  {grupo.itens.map((renovacao) => (
                    <RenewalCard key={renovacao.id} renovacao={renovacao} actions={buildActions(renovacao)} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
