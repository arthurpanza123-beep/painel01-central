'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  TestTube2, Users, Kanban, Wallet, Zap,
  ArrowUpRight, Activity, Clock
} from 'lucide-react'
import type { NavPage } from '@/app/page'
// MOCK: importação direta dos mocks — usada como fallback quando metrics não é passado
// MIGRAÇÃO FUTURA: remover estas importações quando getDashboardData() for chamado
//   no Server Component pai (app/page.tsx) e os dados forem passados via props.
import {
  MOCK_TESTES, MOCK_CLIENTES, MOCK_PIPELINE, MOCK_CREDITOS,
  calcularMetricasFinanceiro, calcularMetricasPipeline,
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
  const fin  = calcularMetricasFinanceiro()
  const pipe = calcularMetricasPipeline()

  const testesAtivos   = dashboardMetrics?.active_tests        ?? MOCK_TESTES.filter(t => t.status === 'ativo').length
  const testesHoje     = dashboardMetrics?.total_tests         ?? MOCK_TESTES.length
  const leadsAndamento = dashboardMetrics?.leads_in_progress   ?? MOCK_PIPELINE.filter(l => l.etapa !== 'ativado' && l.etapa !== 'renovacao').length
  const clientesAtivos = dashboardMetrics?.active_clients      ?? MOCK_CLIENTES.filter(c => c.status === 'ativo').length
  const creditos       = dashboardMetrics?.available_credits   ?? fin.creditosDisponiveis
  const receitaPrevista = dashboardMetrics?.revenue_forecast_30d ?? fin.receitaPrevista30d

  const serie = [
    { label: 'Hoje', value: dashboardMetrics?.revenue_current_month  ?? fin.receitaMesAtual },
    { label: '30d',  value: dashboardMetrics?.revenue_forecast_30d   ?? fin.receitaPrevista30d },
    { label: '60d',  value: dashboardMetrics?.revenue_forecast_60d   ?? fin.receitaPrevista60d },
    { label: '90d',  value: dashboardMetrics?.revenue_forecast_90d   ?? fin.receitaPrevista90d },
  ]
  const maxSerie = Math.max(...serie.map(s => s.value), 1)

  // MOCK: funil vem do pipe mock ou de metrics.funnel
  const funil = dashboardMetrics?.funnel
    ? dashboardMetrics.funnel.map(f => ({ label: f.label, value: f.count, color: f.color }))
    : [
        { label: 'Leads',     value: pipe.novo_lead + pipe.contato,    color: '#3b82f6' },
        { label: 'Testando',  value: pipe.teste_gerado + pipe.testando, color: '#f59e0b' },
        { label: 'Interesse', value: pipe.interessado,                  color: '#a78bfa' },
        { label: 'Pagaram',   value: pipe.pagou,                        color: '#22c55e' },
        { label: 'Ativados',  value: pipe.ativado,                      color: '#14b8a6' },
      ]

  // MOCK: créditos vêm do mock ou de metrics.panel_credits
  const painelCreditos = dashboardMetrics?.panel_credits
    ? dashboardMetrics.panel_credits.map(c => ({ id: c.id, painel: c.panel, saldo: c.balance, alertaBaixo: c.low_balance }))
    : MOCK_CREDITOS

  const kpis = [
    { label: 'Testes ativos',      value: testesAtivos,   icon: TestTube2, color: '#3b82f6', page: 'testes'   as NavPage },
    { label: 'Gerados hoje',       value: testesHoje,     icon: Zap,       color: '#f59e0b', page: 'testes'   as NavPage },
    { label: 'Leads em andamento', value: leadsAndamento, icon: Kanban,    color: '#a78bfa', page: 'pipeline' as NavPage },
    { label: 'Clientes ativos',    value: clientesAtivos, icon: Users,     color: '#22c55e', page: 'clientes' as NavPage },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden">
      <BgGlow />
      <div className="relative px-6 py-10 max-w-5xl mx-auto w-full" style={{ zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4" style={{ color: '#3b82f6' }} />
            <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Central de comando</span>
          </div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Central Play Plus
          </h1>
          <p className="text-slate-500 text-sm mt-1">Visão geral da operação · {new Date().toLocaleDateString('pt-BR')}</p>
        </motion.div>

        {/* KPIs grandes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {kpis.map((k, i) => (
            <motion.button
              key={k.label}
              onClick={() => onNavigate(k.page)}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -3 }}
              className="text-left rounded-2xl p-5 group relative overflow-hidden"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div
                className="absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-20 transition-opacity group-hover:opacity-40"
                style={{ background: `radial-gradient(circle, ${k.color}, transparent 70%)` }}
              />
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl mb-4"
                style={{ background: `${k.color}1f`, border: `1px solid ${k.color}40` }}
              >
                <k.icon className="h-5 w-5" style={{ color: k.color }} />
              </div>
              <p className="text-3xl font-bold text-white leading-none mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                {k.value}
              </p>
              <p className="text-xs text-slate-500">{k.label}</p>
            </motion.button>
          ))}
        </div>

        {/* Receita + créditos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="lg:col-span-2 rounded-2xl p-6 relative overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div
              className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, #22c55e, transparent 70%)' }}
            />
            <div className="relative flex items-start justify-between mb-5">
              <div>
                <p className="text-xs text-slate-500 mb-1">Receita prevista (30 dias)</p>
                <p className="text-4xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  R$ {receitaPrevista.toFixed(0)}
                </p>
                <p className="text-xs flex items-center gap-1 mt-1.5" style={{ color: '#22c55e' }}>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Projeção crescente nos próximos 90 dias
                </p>
              </div>
              <button
                onClick={() => onNavigate('financeiro')}
                className="text-xs px-3 h-8 rounded-lg font-medium transition-colors"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}
              >
                Financeiro
              </button>
            </div>
            <div className="relative flex items-end justify-between gap-3 h-28">
              {serie.map((s, i) => (
                <div key={s.label} className="flex-1 flex flex-col items-center justify-end h-full gap-2">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(s.value / maxSerie) * 100}%` }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
                    className="w-full rounded-t-lg relative group"
                    style={{
                      background: i === 0
                        ? 'linear-gradient(180deg, #22c55e, rgba(34,197,94,0.3))'
                        : 'linear-gradient(180deg, rgba(34,197,94,0.5), rgba(34,197,94,0.08))',
                      minHeight: 6,
                    }}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      R$ {s.value.toFixed(0)}
                    </span>
                  </motion.div>
                  <span className="text-[10px] text-slate-500">{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.button
            onClick={() => onNavigate('financeiro')}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="text-left rounded-2xl p-6 relative overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-4 w-4" style={{ color: '#a78bfa' }} />
              <span className="text-xs text-slate-500">Créditos disponíveis</span>
            </div>
            <p className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              R$ {creditos.toFixed(0)}
            </p>
            <div className="space-y-2.5">
              {painelCreditos.slice(0, 4).map(c => (
                <div key={c.id} className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    {c.alertaBaixo && <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#f59e0b' }} />}
                    {c.painel}
                  </span>
                  <span className="text-xs font-medium" style={{ color: c.alertaBaixo ? '#f59e0b' : '#94a3b8' }}>
                    R$ {c.saldo.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </motion.button>
        </div>

        {/* Funil */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl p-6"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" style={{ color: '#3b82f6' }} />
              <h2 className="text-sm font-semibold text-white">Hoje na operação</h2>
            </div>
            <div className="flex items-center gap-3">
              {/* Indicador de fonte de dados — MOCK = laranja, Supabase = verde */}
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: dashboardMetrics?.data_source === 'supabase' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                  color:      dashboardMetrics?.data_source === 'supabase' ? '#4ade80' : '#fbbf24',
                  border:     `1px solid ${dashboardMetrics?.data_source === 'supabase' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
                }}
              >
                {dashboardMetrics?.data_source === 'supabase' ? 'Supabase' : 'Mock'}
              </span>
              <button
                onClick={() => onNavigate('pipeline')}
                className="text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1"
              >
                Ver pipeline <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {funil.map(f => (
              <div
                key={f.label}
                className="rounded-xl p-4 relative overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}
              >
                <div className="h-1 w-8 rounded-full mb-3" style={{ background: f.color }} />
                <p className="text-2xl font-bold text-white leading-none mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  {f.value}
                </p>
                <p className="text-[11px] text-slate-500">{f.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function BgGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute rounded-full"
        style={{
          width: 600, height: 600, top: '-15%', left: '-10%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.10) 0%, transparent 65%)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 500, height: 500, top: '20%', right: '-12%',
          background: 'radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 65%)',
        }}
      />
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
