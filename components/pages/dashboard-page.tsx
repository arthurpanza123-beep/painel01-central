'use client'

import { useEffect, useState } from 'react'
import { m as motion } from 'framer-motion'
import {
  TestTube2, Users, ClipboardList, Zap,
  Activity, TrendingUp, Wallet, ArrowUpRight,
} from 'lucide-react'
import type { NavPage } from '@/app/page'
// MOCK: importação direta dos mocks — usada como fallback quando metrics não é passado
// MIGRAÇÃO FUTURA: remover estas importações quando getDashboardData() for chamado
//   no Server Component pai (app/page.tsx) e os dados forem passados via props.
import {
  MOCK_TESTES, MOCK_CLIENTES, MOCK_PIPELINE,
} from '@/lib/mock-data'
import type { DashboardMetrics } from '@/lib/supabase/types'

interface DashboardPageProps {
  onNavigate: (p: NavPage) => void
  /**
   * Dados vindos de getDashboardData() (lib/queries/dashboard.ts).
   * Se não for passado, o componente usa os mocks diretamente.
   * MIGRAÇÃO FUTURA: tornar obrigatório quando o Server Component pai
   *   passar os dados reais.
   */
  metrics?: DashboardMetrics
}

export function DashboardPage({ onNavigate, metrics }: DashboardPageProps) {
  const [remoteMetrics, setRemoteMetrics] = useState<DashboardMetrics | undefined>(metrics)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DashboardMetrics | null) => {
        if (!cancelled && data) setRemoteMetrics(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const dashboardMetrics = remoteMetrics ?? metrics

  // ── Fallback para mock quando metrics não for fornecido (estado atual) ──
  // MOCK: bloco abaixo é temporário — remover quando metrics vier do Supabase
  const testesAtivos   = dashboardMetrics?.active_tests        ?? MOCK_TESTES.filter(t => t.status === 'ativo').length
  const operacaoHoje   = dashboardMetrics?.leads_in_progress   ?? MOCK_PIPELINE.filter(l => l.etapa !== 'ativado' && l.etapa !== 'renovacao').length
  const clientesAtivos = dashboardMetrics?.active_clients      ?? MOCK_CLIENTES.filter(c => c.status === 'ativo').length

  // Base mensal de renovação = soma do valor de TODOS os clientes ativos
  const renovacaoBase = dashboardMetrics?.monthly_renewal_base
    ?? MOCK_CLIENTES.filter(c => c.status === 'ativo').reduce((acc, c) => acc + (c.valor ?? 0), 0)

  // Ambientes ativados hoje (clientes ativados na data de hoje)
  const hojeBR = new Date().toLocaleDateString('pt-BR')
  const ativadosHoje = dashboardMetrics?.activated_today
    ?? MOCK_CLIENTES.filter(c => c.criadoEm === hojeBR).length

  // Faturado hoje = soma dos pagamentos confirmados (leads que pagaram)
  const faturadoHoje = dashboardMetrics?.revenue_today
    ?? MOCK_PIPELINE.filter(l => l.etapa === 'pagou').reduce((acc, l) => acc + (l.valor ?? 0), 0)

  const kpis = [
    { label: 'Testes ativos hoje', value: testesAtivos,   icon: TestTube2,     color: '#3b82f6', page: 'testes'   as NavPage },
    { label: 'Operação hoje',      value: operacaoHoje,   icon: ClipboardList, color: '#f59e0b', page: 'pipeline' as NavPage },
    { label: 'Clientes ativos',    value: clientesAtivos, icon: Users,         color: '#22c55e', page: 'clientes' as NavPage },
    { label: 'Ativados hoje',      value: ativadosHoje,   icon: Zap,           color: '#14b8a6', page: 'clientes' as NavPage },
  ]

  return (
    <div className="relative min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-3.5rem)] overflow-hidden">
      <BgGlow />
      <div className="relative px-4 py-6 sm:px-6 sm:py-10 max-w-5xl mx-auto w-full" style={{ zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-5 sm:mb-8"
        >
          <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
            <Activity className="h-4 w-4" style={{ color: '#3b82f6' }} />
            <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Central de comando</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Central Play Plus
          </h1>
          <p className="text-slate-500 text-sm mt-1">Visão geral da operação · {new Date().toLocaleDateString('pt-BR')}</p>
        </motion.div>

        {/* KPIs grandes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 sm:mb-4">
          {kpis.map((k, i) => (
            <motion.button
              key={k.label}
              onClick={() => onNavigate(k.page)}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              className="text-left rounded-2xl p-4 sm:p-5 group relative overflow-hidden"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl mb-3 sm:mb-4"
                style={{ background: `${k.color}1f`, border: `1px solid ${k.color}40` }}
              >
                <k.icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: k.color }} />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white leading-none mb-1 sm:mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                {k.value}
              </p>
              <p className="text-xs text-slate-500">{k.label}</p>
            </motion.button>
          ))}
        </div>

        {/* Faturado hoje — mini card horizontal */}
        <motion.button
          onClick={() => onNavigate('financeiro')}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          whileHover={{ y: -2 }}
          className="w-full flex items-center gap-3 rounded-2xl p-4 mb-3 sm:mb-4 text-left"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            <Wallet className="h-5 w-5" style={{ color: '#22c55e' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500">Faturado hoje</p>
            <p className="text-xl sm:text-2xl font-bold text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              R$ {Math.round(faturadoHoje).toLocaleString('pt-BR')}
            </p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-500 shrink-0" />
        </motion.button>

        {/* Projeção de renovação */}
        <RenovacaoProjecao base={renovacaoBase} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

// ─── Projeção de renovação baseada na base mensal de clientes ativos ───
// Regra: Mês = base (100%); demais períodos = base × meses × 0,8 (desconto de 20%).
// Valor fica oculto e só aparece ao passar o mouse (desktop) ou tocar (celular).
function RenovacaoProjecao({ base, onNavigate }: { base: number; onNavigate: (p: NavPage) => void }) {
  const [ativo, setAtivo] = useState<number | null>(null)

  const periodos = [
    { label: 'Mês',     meses: 1 },
    { label: '60 dias', meses: 2 },
    { label: '3 meses', meses: 3 },
    { label: '6 meses', meses: 6 },
    { label: '1 ano',   meses: 12 },
  ]
  const valorDe = (meses: number) => (meses === 1 ? base : base * meses * 0.8)
  const maxValor = Math.max(...periodos.map(p => valorDe(p.meses)), 1)
  const fmt = (v: number) =>
    'R$ ' + Math.round(v).toLocaleString('pt-BR')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="rounded-2xl p-4 sm:p-6 relative overflow-hidden mb-4"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="relative flex items-start justify-between mb-4 sm:mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4" style={{ color: '#22c55e' }} />
            <p className="text-sm font-semibold text-white">Projeção de renovação</p>
          </div>
          <p className="text-xs text-slate-500">
            Estimativa por período · toque para destacar
          </p>
        </div>
        <button
          onClick={() => onNavigate('financeiro')}
          className="text-xs px-3 h-8 rounded-lg font-medium transition-colors shrink-0"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}
        >
          Financeiro
        </button>
      </div>

      <div className="relative grid grid-cols-5 gap-2 sm:gap-3 items-end">
        {periodos.map((p, i) => {
          const valor = valorDe(p.meses)
          const revelado = ativo === i
          const altura = 24 + (valor / maxValor) * 64 // 24px base + até ~88px
          return (
            <button
              key={p.label}
              type="button"
              onMouseEnter={() => setAtivo(i)}
              onMouseLeave={() => setAtivo(prev => (prev === i ? null : prev))}
              onClick={() => setAtivo(prev => (prev === i ? null : i))}
              className="flex flex-col items-center justify-end gap-2 focus:outline-none"
              aria-label={`${p.label}: ${fmt(valor)}`}
            >
              <motion.span
                animate={revelado ? { scale: 1.12, y: -1 } : { scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                className="text-[10px] sm:text-xs font-bold whitespace-nowrap origin-bottom"
                style={{ color: revelado ? '#4ade80' : '#94a3b8' }}
              >
                {fmt(valor)}
              </motion.span>
              <motion.div
                animate={revelado
                  ? { height: altura + 10, scaleX: 1.04 }
                  : { height: altura, scaleX: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                className="w-full rounded-t-lg origin-bottom"
                style={{
                  background: revelado
                    ? 'linear-gradient(180deg, #22c55e, rgba(34,197,94,0.4))'
                    : 'linear-gradient(180deg, rgba(34,197,94,0.5), rgba(34,197,94,0.1))',
                  border: revelado ? '1px solid rgba(34,197,94,0.6)' : '1px solid transparent',
                  boxShadow: revelado ? '0 0 16px rgba(34,197,94,0.35)' : 'none',
                }}
              />
              <span className={`text-[10px] sm:text-xs transition-colors ${revelado ? 'text-white' : 'text-slate-500'}`}>
                {p.label}
              </span>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

function BgGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.015) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  )
}
