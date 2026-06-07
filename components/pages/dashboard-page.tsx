'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowUpRight,
  ClipboardList,
  TestTube2,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import type { NavPage } from '@/app/page'
import {
  MOCK_CLIENTES,
  MOCK_PIPELINE,
  MOCK_TESTES,
} from '@/lib/mock-data'
import type { DashboardMetrics } from '@/lib/supabase/types'

interface DashboardPageProps {
  onNavigate: (p: NavPage) => void
  metrics?: DashboardMetrics
}

export function DashboardPage({ onNavigate, metrics }: DashboardPageProps) {
  const [remoteMetrics, setRemoteMetrics] = useState<DashboardMetrics | undefined>(metrics)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard', { cache: 'no-store' })
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
  const testesAtivos = dashboardMetrics?.active_tests ?? MOCK_TESTES.filter(t => t.status === 'ativo').length
  const operacaoHoje = dashboardMetrics?.leads_in_progress ?? MOCK_PIPELINE.filter(l => l.etapa !== 'ativado' && l.etapa !== 'renovacao').length
  const clientesAtivos = dashboardMetrics?.active_clients ?? MOCK_CLIENTES.filter(c => c.status === 'ativo').length
  const renovacaoBase = dashboardMetrics?.monthly_renewal_forecast
    ?? dashboardMetrics?.monthly_renewal_base
    ?? MOCK_CLIENTES.filter(c => c.status === 'ativo').reduce((acc, c) => acc + (c.valor ?? 0), 0)
  const hojeBR = new Date().toLocaleDateString('pt-BR')
  const ativadosHoje = dashboardMetrics?.activated_today ?? MOCK_CLIENTES.filter(c => c.criadoEm === hojeBR).length
  const faturadoHoje = dashboardMetrics?.revenue_today ?? MOCK_PIPELINE.filter(l => l.etapa === 'pagou').reduce((acc, l) => acc + (l.valor ?? 0), 0)

  const kpis = [
    { label: 'Testes ativos hoje', value: testesAtivos, icon: TestTube2, color: '#3b82f6', page: 'testes' as NavPage },
    { label: 'Operação hoje', value: operacaoHoje, icon: ClipboardList, color: '#f59e0b', page: 'pipeline' as NavPage },
    { label: 'Clientes ativos', value: clientesAtivos, icon: Users, color: '#22c55e', page: 'clientes' as NavPage },
    { label: 'Ativados hoje', value: ativadosHoje, icon: Zap, color: '#14b8a6', page: 'clientes' as NavPage },
  ]

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden md:min-h-[calc(100vh-3.5rem)]">
      <BgGlow />
      <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10" style={{ zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 sm:mb-8"
        >
          <div className="mb-1.5 flex items-center gap-2 sm:mb-2">
            <Activity className="h-4 w-4" style={{ color: '#3b82f6' }} />
            <span className="text-xs font-medium uppercase tracking-widest text-slate-500">Central de comando</span>
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl" style={{ fontFamily: 'var(--font-display)' }}>
            Central Play Plus
          </h1>
          <p className="mt-1 text-sm text-slate-500">Visão geral da operação · {hojeBR}</p>
        </motion.div>

        <div className="mb-3 grid grid-cols-2 gap-3 sm:mb-4 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <motion.button
              key={k.label}
              onClick={() => onNavigate(k.page)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              className="group relative overflow-hidden rounded-2xl p-4 text-left sm:p-5"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl sm:mb-4 sm:h-10 sm:w-10"
                style={{ background: `${k.color}1f`, border: `1px solid ${k.color}40` }}
              >
                <k.icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: k.color }} />
              </div>
              <p className="mb-1 text-2xl font-bold leading-none text-white sm:mb-1.5 sm:text-3xl" style={{ fontFamily: 'var(--font-display)' }}>
                {k.value}
              </p>
              <p className="text-xs text-slate-500">{k.label}</p>
            </motion.button>
          ))}
        </div>

        <motion.button
          onClick={() => onNavigate('financeiro')}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          whileHover={{ y: -2 }}
          className="mb-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left sm:mb-4"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            <Wallet className="h-5 w-5" style={{ color: '#22c55e' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">Faturado hoje</p>
            <p className="text-xl font-bold leading-tight text-white sm:text-2xl" style={{ fontFamily: 'var(--font-display)' }}>
              R$ {Math.round(faturadoHoje).toLocaleString('pt-BR')}
            </p>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500" />
        </motion.button>

        <RenovacaoProjecao base={renovacaoBase} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function RenovacaoProjecao({ base, onNavigate }: { base: number; onNavigate: (p: NavPage) => void }) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const periodos = [
    { label: 'Mês', meses: 1 },
    { label: '60 dias', meses: 2 },
    { label: '3 meses', meses: 3 },
    { label: '6 meses', meses: 6 },
    { label: '1 ano', meses: 12 },
  ]
  const valorDe = (meses: number) => base * meses
  const maxValor = Math.max(...periodos.map(p => valorDe(p.meses)), 1)
  const fmt = (value: number) => `R$ ${Math.round(value).toLocaleString('pt-BR')}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative mb-4 overflow-hidden rounded-2xl p-4 sm:p-6"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="relative mb-4 flex items-start justify-between sm:mb-5">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: '#22c55e' }} />
            <p className="text-sm font-semibold text-white">Projeção de renovação</p>
          </div>
          <p className="text-xs text-slate-500">Mesma base do Financeiro · toque para destacar</p>
        </div>
        <button
          onClick={() => onNavigate('financeiro')}
          className="h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}
        >
          Financeiro
        </button>
      </div>

      <div className="relative grid grid-cols-5 items-end gap-2 sm:gap-3">
        {periodos.map((periodo, index) => {
          const valor = valorDe(periodo.meses)
          const revelado = ativo === index
          const altura = 24 + (valor / maxValor) * 64
          return (
            <button
              key={periodo.label}
              type="button"
              onMouseEnter={() => setAtivo(index)}
              onMouseLeave={() => setAtivo(prev => (prev === index ? null : prev))}
              onClick={() => setAtivo(prev => (prev === index ? null : index))}
              className="flex flex-col items-center justify-end gap-2 focus:outline-none"
              aria-label={`${periodo.label}: ${fmt(valor)}`}
            >
              <motion.span
                animate={revelado ? { scale: 1.12, y: -1 } : { scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                className="origin-bottom whitespace-nowrap text-[10px] font-bold sm:text-xs"
                style={{ color: revelado ? '#4ade80' : '#94a3b8' }}
              >
                {fmt(valor)}
              </motion.span>
              <motion.div
                animate={revelado ? { height: altura + 10, scaleX: 1.04 } : { height: altura, scaleX: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                className="w-full origin-bottom rounded-t-lg"
                style={{
                  background: revelado
                    ? 'linear-gradient(180deg, #22c55e, rgba(34,197,94,0.4))'
                    : 'linear-gradient(180deg, rgba(34,197,94,0.5), rgba(34,197,94,0.1))',
                  border: revelado ? '1px solid rgba(34,197,94,0.6)' : '1px solid transparent',
                  boxShadow: revelado ? '0 0 16px rgba(34,197,94,0.35)' : 'none',
                }}
              />
              <span className={`text-[10px] transition-colors sm:text-xs ${revelado ? 'text-white' : 'text-slate-500'}`}>
                {periodo.label}
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
