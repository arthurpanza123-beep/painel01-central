'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Send, TrendingUp, TestTube2, Search, Radio
} from 'lucide-react'
import {
  MOCK_TESTES,
  type Teste,
  type StatusTeste
} from '@/lib/mock-data'
import { useToast } from '@/components/ui/toast'

const JANELA_TESTE_MS = 4 * 60 * 60 * 1000 // janela padrão de teste: 4h

// ——— Countdown hook ———
function useCountdown(validade: string) {
  const [remaining, setRemaining] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [pct, setPct] = useState(100)

  useEffect(() => {
    const calc = () => {
      const parts = validade.split(' ')
      const dateParts = parts[0].split('/')
      const timeParts = parts[1] ? parts[1].split(':') : ['23', '59']
      const target = new Date(
        Number(dateParts[2]),
        Number(dateParts[1]) - 1,
        Number(dateParts[0]),
        Number(timeParts[0]),
        Number(timeParts[1])
      )
      const diff = target.getTime() - Date.now()
      if (diff <= 0) {
        setRemaining('Expirado')
        setUrgente(true)
        setPct(0)
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setUrgente(h < 4)
      setPct(Math.max(0, Math.min(100, (diff / JANELA_TESTE_MS) * 100)))
      if (h >= 24) setRemaining(`${Math.floor(h / 24)}d ${h % 24}h`)
      else setRemaining(`${h}h ${m}m`)
    }
    calc()
    const id = setInterval(calc, 30000)
    return () => clearInterval(id)
  }, [validade])

  return { remaining, urgente, pct }
}

// ——— Status config ———
const STATUS: Record<StatusTeste, { label: string; color: string }> = {
  ativo:        { label: 'Ativo',    color: '#22c55e' },
  expirado:     { label: 'Expirado', color: '#ef4444' },
  pago:         { label: 'Pago',     color: '#3b82f6' },
  sem_resposta: { label: 'Aguardando', color: '#f59e0b' },
}

// ——— Card de teste focado em countdown ———
function TesteCard({
  teste, onWhatsApp, onReenviar, onConverter,
}: {
  teste: Teste
  onWhatsApp: () => void
  onReenviar: () => void
  onConverter: () => void
}) {
  const { remaining, urgente, pct } = useCountdown(teste.validade)
  const cfg = STATUS[teste.status]
  const isAtivo = teste.status === 'ativo'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-2xl p-5 transition-all relative overflow-hidden"
      style={{
        background: 'var(--card)',
        border: isAtivo && urgente
          ? '1px solid rgba(239,68,68,0.35)'
          : '1px solid var(--border)',
      }}
    >
      {isAtivo && urgente && (
        <div
          className="absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #ef4444, transparent 70%)' }}
        />
      )}
      <div className="relative flex items-start gap-4">
        {/* Countdown grande */}
        <div className="text-center shrink-0 min-w-[84px]">
          {isAtivo ? (
            <>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: urgente ? '#f87171' : '#4ade80' }}
                />
                <p
                  className="text-2xl font-bold tabular-nums leading-none"
                  style={{ color: urgente ? '#f87171' : '#4ade80', fontFamily: 'var(--font-display)' }}
                >
                  {remaining}
                </p>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">restante</p>
              {/* barra de progresso */}
              <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6 }}
                  style={{ background: urgente ? '#f87171' : '#4ade80' }}
                />
              </div>
            </>
          ) : (
            <>
              <div
                className="h-9 w-9 rounded-full mx-auto flex items-center justify-center mb-1"
                style={{ background: `${cfg.color}20` }}
              >
                <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label.charAt(0)}</span>
              </div>
              <p className="text-[10px]" style={{ color: cfg.color }}>{cfg.label}</p>
            </>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white truncate">{teste.cliente}</h3>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{ background: `${cfg.color}15`, color: cfg.color }}
            >
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            {teste.app} · {teste.servidor} · {teste.telefone}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onReenviar}
              className="h-7 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all"
              style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}
            >
              <Send className="h-3 w-3" /> Reenviar
            </button>
            <button
              onClick={onWhatsApp}
              className="h-7 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </button>
            {(isAtivo || teste.status === 'sem_resposta') && (
              <button
                onClick={onConverter}
                className="h-7 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all"
                style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <TrendingUp className="h-3 w-3" /> Converter
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ——— Page ———
export function TestesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusTeste | 'todos'>('todos')
  const [testes, setTestes] = useState(MOCK_TESTES)
  const [dataSource, setDataSource] = useState<'mock' | 'supabase'>('mock')
  const { addToast } = useToast()

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch('/api/tests', { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar testes')
        const payload = await res.json()
        if (!alive) return
        setTestes(Array.isArray(payload.items) ? payload.items : MOCK_TESTES)
        setDataSource(payload.data_source === 'supabase' ? 'supabase' : 'mock')
      } catch {
        if (!alive) return
        setTestes(MOCK_TESTES)
        setDataSource('mock')
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const metricas = {
    testesAtivosHoje: testes.filter(t => t.status === 'ativo').length,
    testesExpirando: testes.filter(t => t.status === 'ativo').length,
    testesPagos: testes.filter(t => t.status === 'pago').length,
    conversaoDia: testes.length > 0 ? Math.round((testes.filter(t => t.status === 'pago').length / testes.length) * 100) : 0,
  }

  const testesFiltrados = testes.filter(t => {
    const matchSearch =
      t.cliente.toLowerCase().includes(search.toLowerCase()) ||
      t.telefone.includes(search) ||
      t.app.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const testesOrdenados = [...testesFiltrados].sort((a, b) => {
    const ordem: Record<StatusTeste, number> = { ativo: 0, sem_resposta: 1, expirado: 2, pago: 3 }
    return (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9)
  })

  const handleWhatsApp = (t: Teste) => {
    const tel = t.telefone.replace(/\D/g, '')
    const msg = encodeURIComponent(`Ola ${t.cliente}! Segue seu acesso:\n\nApp: ${t.app}\nServidor: ${t.servidor}\nUsuario: ${t.usuario}\nSenha: ${t.senha}\nValidade: ${t.validade}`)
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
  }

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-10 min-h-screen">
      {/* Header centralizado */}
      <div className="text-center mb-8 max-w-xl">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Radio className="h-4 w-4 animate-pulse" style={{ color: '#60a5fa' }} />
          <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Monitoramento ao vivo</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Testes em tempo real
        </h1>
        <p className="text-slate-500 text-sm">
          {metricas.testesAtivosHoje} testes ativos
          {metricas.testesExpirando > 0 && ` · ${metricas.testesExpirando} expirando em breve`}
        </p>
        <p className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
           style={{ background: dataSource === 'supabase' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: dataSource === 'supabase' ? '#4ade80' : '#fbbf24' }}>
          Fonte: {dataSource === 'supabase' ? 'Supabase' : 'Mock'}
        </p>
      </div>

      {/* KPIs compactos */}
      <div className="flex items-center gap-8 mb-8">
        {[
          { label: 'Ativos', value: metricas.testesAtivosHoje, color: '#22c55e' },
          { label: 'Expirando', value: metricas.testesExpirando, color: '#f59e0b' },
          { label: 'Pagos', value: metricas.testesPagos, color: '#3b82f6' },
          { label: 'Conversao', value: `${metricas.conversaoDia}%`, color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <p className="text-xl font-bold" style={{ color, fontFamily: 'var(--font-display)' }}>{value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* Busca + filtros */}
      <div className="w-full max-w-3xl mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar cliente, telefone ou app..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['todos', 'ativo', 'sem_resposta', 'expirado', 'pago'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-3 h-10 rounded-xl text-xs font-medium transition-all"
                style={
                  statusFilter === s
                    ? { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }
                    : { background: 'var(--card)', border: '1px solid var(--border)', color: '#64748b' }
                }
              >
                {s === 'todos' ? 'Todos' : STATUS[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="w-full max-w-3xl space-y-3">
        <AnimatePresence>
          {testesOrdenados.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <TestTube2 className="h-10 w-10 mx-auto mb-3" style={{ color: '#1e293b' }} />
              <p className="text-slate-500 text-sm">Nenhum teste encontrado</p>
            </div>
          ) : (
            testesOrdenados.map((teste) => (
              <TesteCard
                key={teste.id}
                teste={teste}
                onWhatsApp={() => handleWhatsApp(teste)}
                onReenviar={() => { handleWhatsApp(teste); addToast('success', 'Abrindo WhatsApp...') }}
                onConverter={() => addToast('success', `${teste.cliente} movido para Interessado!`)}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
