'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign, TrendingUp, CreditCard, AlertTriangle,
  ArrowUpRight, Wallet, Target, Layers
} from 'lucide-react'
import {
  MOCK_CREDITOS, MOCK_CLIENTES,
  type CreditoPainel,
} from '@/lib/mock-data'

type FinanceData = {
  data_source: 'mock' | 'supabase'
  metrics: {
    receitaMesAtual: number
    receitaPrevista30d: number
    receitaPrevista60d: number
    receitaPrevista90d: number
    lucroEstimado: number
    renovacoesPrevistas: number
    creditosDisponiveis: number
    ticketMedio: number
    clientesAtivos: number
    conversaoDia: number
    testesPagos: number
    testesAtivosHoje: number
  }
  porPlano: { plano: string; valor: number }[]
  creditos: CreditoPainel[]
}

function buildFallbackFinance(): FinanceData {
  const clientesAtivos = MOCK_CLIENTES.filter(c => c.status === 'ativo')
  const receitaMesAtual = clientesAtivos.reduce((acc, c) => acc + c.valor, 0)
  const porPlanoMap = clientesAtivos.reduce<Record<string, number>>((acc, c) => {
    acc[c.plano] = (acc[c.plano] || 0) + c.valor
    return acc
  }, {})

  return {
    data_source: 'mock',
    metrics: {
      receitaMesAtual,
      receitaPrevista30d: receitaMesAtual,
      receitaPrevista60d: receitaMesAtual * 2,
      receitaPrevista90d: receitaMesAtual * 3,
      lucroEstimado: receitaMesAtual - MOCK_CREDITOS.reduce((acc, c) => acc + (c.custoPorAtivacao * 5), 0),
      renovacoesPrevistas: clientesAtivos.length,
      creditosDisponiveis: MOCK_CREDITOS.reduce((acc, c) => acc + c.saldo, 0),
      ticketMedio: clientesAtivos.length ? receitaMesAtual / clientesAtivos.length : 0,
      clientesAtivos: clientesAtivos.length,
      conversaoDia: 0,
      testesPagos: 0,
      testesAtivosHoje: 0,
    },
    porPlano: Object.entries(porPlanoMap).map(([plano, valor]) => ({ plano, valor })).sort((a, b) => b.valor - a.valor),
    creditos: MOCK_CREDITOS,
  }
}

// ——— KPI grande ———
function BigKPI({
  label, value, color, sub, icon: Icon,
}: {
  label: string
  value: string
  color: string
  sub?: string
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div
        className="absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-20"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
      />
      <div className="relative">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg mb-4"
          style={{ background: `${color}1f`, border: `1px solid ${color}40` }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <p className="text-2xl font-bold text-white leading-none mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
        {sub && (
          <p className="text-[11px] flex items-center gap-1 mt-2" style={{ color }}>
            <ArrowUpRight className="h-3 w-3" /> {sub}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ——— Barra horizontal ———
function Bar({ label, value, max, color, suffix = '' }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = Math.min((value / (max || 1)) * 100, 100)
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-sm font-semibold w-20 text-right" style={{ color }}>
        {suffix === '%' ? `${value.toFixed(0)}%` : `R$ ${value.toFixed(0)}`}
      </span>
    </div>
  )
}

// ——— Credito do painel ———
function CreditoCard({ credito }: { credito: CreditoPainel }) {
  const baixo = credito.alertaBaixo
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: baixo ? 'rgba(239,68,68,0.06)' : 'var(--card)',
        border: baixo ? '1px solid rgba(239,68,68,0.18)' : '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center"
            style={{ background: baixo ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)' }}
          >
            <CreditCard className="h-4 w-4" style={{ color: baixo ? '#ef4444' : '#60a5fa' }} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{credito.painel}</p>
            <p className="text-[10px] text-slate-500">R$ {credito.custoPorAtivacao.toFixed(2)}/ativação</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold" style={{ color: baixo ? '#ef4444' : '#22c55e', fontFamily: 'var(--font-display)' }}>
            R$ {credito.saldo.toFixed(0)}
          </p>
          <p className="text-[10px] text-slate-500">saldo</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{credito.ativacoesRestantes} ativações restantes</span>
        {baixo && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
            Recarregar
          </span>
        )}
      </div>
    </div>
  )
}

// ——— Page ———
export function FinanceiroPage() {
  const [finance, setFinance] = useState<FinanceData>(buildFallbackFinance)
  const fin = finance.metrics
  const creditosBaixos = finance.creditos.filter(c => c.alertaBaixo)
  const porPlano = finance.porPlano
  const maxPlano = Math.max(...porPlano.map(p => p.valor), 1)

  const maxProjecao = Math.max(fin.receitaPrevista30d, fin.receitaPrevista60d, fin.receitaPrevista90d) * 1.1

  // Conversões (funil resumido)
  const conversoes = [
    { label: 'Conversão hoje', value: fin.conversaoDia, color: '#a78bfa' },
    { label: 'Testes → pagos', value: fin.testesPagos && fin.testesAtivosHoje ? (fin.testesPagos / (fin.testesPagos + fin.testesAtivosHoje)) * 100 : fin.conversaoDia, color: '#22c55e' },
  ]

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch('/api/finance', { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar financeiro')
        const payload = await res.json()
        if (!alive) return
        setFinance(payload?.metrics && Array.isArray(payload.creditos) ? payload : buildFallbackFinance())
      } catch {
        if (!alive) return
        setFinance(buildFallbackFinance())
      }
    }
    load()
    return () => { alive = false }
  }, [])

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-10 min-h-screen">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10 max-w-xl"
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <DollarSign className="h-4 w-4" style={{ color: '#22c55e' }} />
          <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Controle financeiro</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>Financeiro</h1>
        <p className="text-slate-500">Receita, conversões e saúde dos painéis</p>
        <p className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
           style={{ background: finance.data_source === 'supabase' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: finance.data_source === 'supabase' ? '#4ade80' : '#fbbf24' }}>
          Fonte: {finance.data_source === 'supabase' ? 'Supabase' : 'Mock'}
        </p>
      </motion.div>

      {/* KPIs grandes */}
      <div className="w-full max-w-4xl grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <BigKPI label="Receita atual" value={`R$ ${fin.receitaMesAtual.toFixed(0)}`} color="#22c55e" sub="+12% este mês" icon={DollarSign} />
        <BigKPI label="Prevista (30d)" value={`R$ ${fin.receitaPrevista30d.toFixed(0)}`} color="#60a5fa" sub="próximos 30 dias" icon={TrendingUp} />
        <BigKPI label="Lucro estimado" value={`R$ ${fin.lucroEstimado.toFixed(0)}`} color="#a78bfa" icon={Target} />
        <BigKPI label="Ticket médio" value={`R$ ${fin.ticketMedio.toFixed(0)}`} color="#f59e0b" icon={Wallet} />
      </div>

      {/* Receita por plano + Conversões */}
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-3 mb-8">
        <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-5">
            <Layers className="h-4 w-4" style={{ color: '#22c55e' }} />
            <h2 className="text-sm font-semibold text-white">Receita por plano</h2>
          </div>
          <div className="space-y-3">
            {porPlano.length === 0 ? (
              <p className="text-xs text-slate-600">Sem clientes ativos</p>
            ) : (
              porPlano.map((p, i) => (
                <Bar
                  key={p.plano}
                  label={p.plano}
                  value={p.valor}
                  max={maxPlano}
                  color={['#22c55e', '#60a5fa', '#a78bfa', '#f59e0b'][i % 4]}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-5">
            <Target className="h-4 w-4" style={{ color: '#a78bfa' }} />
            <h2 className="text-sm font-semibold text-white">Conversões</h2>
          </div>
          <div className="space-y-4">
            {conversoes.map(c => (
              <Bar key={c.label} label={c.label} value={c.value} max={100} color={c.color} suffix="%" />
            ))}
            <div className="pt-2 grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <p className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>{fin.clientesAtivos}</p>
                <p className="text-[10px] text-slate-500">clientes ativos</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <p className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>{fin.renovacoesPrevistas}</p>
                <p className="text-[10px] text-slate-500">renovações previstas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projeção */}
      <div className="w-full max-w-4xl mb-8">
        <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-4 w-4" style={{ color: '#60a5fa' }} />
            <h2 className="text-sm font-semibold text-white">Projeção de receita</h2>
          </div>
          <div className="space-y-4">
            <Bar label="30 dias" value={fin.receitaPrevista30d} max={maxProjecao} color="#22c55e" />
            <Bar label="60 dias" value={fin.receitaPrevista60d} max={maxProjecao} color="#60a5fa" />
            <Bar label="90 dias" value={fin.receitaPrevista90d} max={maxProjecao} color="#a78bfa" />
          </div>
        </div>
      </div>

      {/* Alerta créditos */}
      {creditosBaixos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-4xl mb-6"
        >
          <div
            className="rounded-2xl p-5 flex items-center gap-4"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
          >
            <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
              <AlertTriangle className="h-5 w-5" style={{ color: '#ef4444' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Créditos baixos</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {creditosBaixos.map(c => c.painel).join(', ')} {creditosBaixos.length > 1 ? 'precisam' : 'precisa'} de recarga
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Créditos dos painéis */}
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4" style={{ color: '#60a5fa' }} />
            <h2 className="text-sm font-semibold text-white">Créditos dos painéis</h2>
          </div>
          <span className="text-xs text-slate-500">Total: R$ {fin.creditosDisponiveis.toFixed(0)}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {finance.creditos.map((credito) => (
            <CreditoCard key={credito.id} credito={credito} />
          ))}
        </div>
      </div>
    </div>
  )
}
