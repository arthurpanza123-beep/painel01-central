'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Send, TrendingUp, TestTube2, Search, Radio,
  Copy, X, CheckCircle, Clock, ExternalLink, Zap, AlertTriangle
} from 'lucide-react'
import {
  MOCK_TESTES,
  calcularMetricasTestes,
  type Teste,
  type StatusTeste
} from '@/lib/mock-data'
import { useToast } from '@/components/ui/toast'

const JANELA_TESTE_MS = 4 * 60 * 60 * 1000

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(validade: string) {
  const [remaining, setRemaining] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [pct, setPct] = useState(100)

  useEffect(() => {
    const calc = () => {
      const parts = validade.split(' ')
      const d = parts[0].split('/')
      const t = parts[1] ? parts[1].split(':') : ['23', '59']
      const target = new Date(+d[2], +d[1] - 1, +d[0], +t[0], +t[1])
      const diff = target.getTime() - Date.now()
      if (diff <= 0) { setRemaining('Expirado'); setUrgente(true); setPct(0); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setUrgente(h < 4)
      setPct(Math.max(0, Math.min(100, (diff / JANELA_TESTE_MS) * 100)))
      setRemaining(h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`)
    }
    calc()
    const id = setInterval(calc, 30000)
    return () => clearInterval(id)
  }, [validade])

  return { remaining, urgente, pct }
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<StatusTeste, { label: string; color: string }> = {
  ativo:        { label: 'Ativo',      color: '#22c55e' },
  expirado:     { label: 'Expirado',   color: '#ef4444' },
  pago:         { label: 'Pago',       color: '#3b82f6' },
  sem_resposta: { label: 'Aguardando', color: '#f59e0b' },
}

// ─── Drawer de detalhe ────────────────────────────────────────────────────────

function TesteDrawer({ teste, onClose }: { teste: Teste; onClose: () => void }) {
  const { addToast } = useToast()
  const [expirando, setExpirando] = useState(false)
  const [expirado, setExpirado] = useState(false)
  const cfg = STATUS_CFG[teste.status]

  const mensagem = [
    `Olá ${teste.cliente}! Segue seu acesso:`,
    ``,
    `App: ${teste.app}`,
    `Servidor: ${teste.servidor}`,
    `Usuário: ${teste.usuario}`,
    `Senha: ${teste.senha}`,
    `Validade: ${teste.validade}`,
  ].join('\n')

  const copiarMensagem = () => {
    navigator.clipboard.writeText(mensagem)
    addToast('success', 'Mensagem copiada!')
  }

  const abrirWhatsApp = () => {
    const tel = teste.telefone.replace(/\D/g, '')
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(mensagem)}`, '_blank')
  }

  const expirarTeste = async () => {
    setExpirando(true)
    await new Promise(r => setTimeout(r, 900))

    // Copia dados do teste para área de transferência
    const dadosTeste = [
      `EXPIRAR TESTE`,
      `Cliente: ${teste.cliente}`,
      `App: ${teste.app}`,
      `Servidor: ${teste.servidor}`,
      `Usuário: ${teste.usuario}`,
      `Código: ${teste.codigo}`,
    ].join('\n')
    await navigator.clipboard.writeText(dadosTeste)

    setExpirando(false)
    setExpirado(true)
    addToast('success', 'Dados copiados — cole no painel para expirar.')
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 flex flex-col overflow-y-auto"
      style={{ background: 'var(--card)', borderLeft: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h3 className="text-sm font-semibold text-white">{teste.cliente}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{teste.telefone}</p>
        </div>
        <button onClick={onClose} className="h-8 w-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/5">
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 p-5 space-y-5">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium px-3 py-1 rounded-full"
            style={{ background: `${cfg.color}15`, color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span className="text-xs text-slate-500">{teste.validade}</span>
        </div>

        {/* Dados do teste */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {[
            { label: 'Aplicativo', value: teste.app },
            { label: 'Servidor',   value: teste.servidor },
            { label: 'Usuário',    value: teste.usuario },
            { label: 'Senha',      value: teste.senha },
            { label: 'Código',     value: teste.codigo },
            { label: 'Validade',   value: teste.validade },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500 shrink-0">{label}</span>
              <span className="text-xs font-medium text-slate-200 font-mono truncate text-right">{value}</span>
            </div>
          ))}
        </div>

        {/* Mensagem */}
        <div>
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Mensagem</p>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {mensagem}
          </pre>
        </div>

        {/* Ações principais */}
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={copiarMensagem}
            className="h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}>
            <Copy className="h-3.5 w-3.5" /> Copiar
          </button>
          <button onClick={abrirWhatsApp}
            className="h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </button>
          {(teste.status === 'ativo' || teste.status === 'sem_resposta') && (
            <button
              className="col-span-2 h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}
              onClick={() => addToast('success', `${teste.cliente} marcado como pago!`)}
            >
              <CheckCircle className="h-3.5 w-3.5" /> Marcar como pago / Ativar
            </button>
          )}
        </div>

        {/* Expirar teste */}
        {!expirado ? (
          <div className="rounded-2xl p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-xs text-slate-400 mb-3 font-medium">Expirar teste</p>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Copia os dados do teste e simula o envio de aviso de expirado. Cole os dados no painel para remover/expirar.
            </p>
            <button
              onClick={expirarTeste}
              disabled={expirando}
              className="w-full h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              {expirando ? (
                <><span className="h-3.5 w-3.5 rounded-full border-2 border-red-500/40 border-t-red-400 animate-spin" /> Expirando...</>
              ) : (
                <><AlertTriangle className="h-3.5 w-3.5" /> Expirar teste</>
              )}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-xs font-semibold text-red-400">Teste expirado (simulado)</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Dados copiados para a area de transferencia. Cole no painel para remover o acesso.
            </p>
            <a
              href="#"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              onClick={e => { e.preventDefault(); addToast('success', 'Abra o painel manualmente.') }}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir painel usado
            </a>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Card de teste ────────────────────────────────────────────────────────────

function TesteCard({ teste, onOpen }: { teste: Teste; onOpen: () => void }) {
  const { remaining, urgente, pct } = useCountdown(teste.validade)
  const cfg = STATUS_CFG[teste.status]
  const isAtivo = teste.status === 'ativo'

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className="w-full text-left group rounded-2xl p-5 transition-all relative overflow-hidden"
      style={{
        background: 'var(--card)',
        border: isAtivo && urgente ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--border)',
      }}
    >
      {isAtivo && urgente && (
        <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, #ef4444, transparent 70%)' }} />
      )}
      <div className="relative flex items-start gap-4">
        {/* Countdown */}
        <div className="text-center shrink-0 min-w-[80px]">
          {isAtivo ? (
            <>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: urgente ? '#f87171' : '#4ade80' }} />
                <p className="text-xl font-bold tabular-nums leading-none"
                  style={{ color: urgente ? '#f87171' : '#4ade80', fontFamily: 'var(--font-display)' }}>
                  {remaining}
                </p>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">restante</p>
              <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                  style={{ background: urgente ? '#f87171' : '#4ade80' }} />
              </div>
            </>
          ) : (
            <>
              <div className="h-9 w-9 rounded-full mx-auto flex items-center justify-center mb-1" style={{ background: `${cfg.color}20` }}>
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
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{ background: `${cfg.color}15`, color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {teste.app} · {teste.servidor} · {teste.telefone}
          </p>
        </div>

        <Zap className="h-3.5 w-3.5 text-slate-700 group-hover:text-slate-500 transition-colors shrink-0 mt-0.5" />
      </div>
    </motion.button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TestesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusTeste | 'todos'>('todos')
  const [testes] = useState<Teste[]>(MOCK_TESTES)
  const [selectedTeste, setSelectedTeste] = useState<Teste | null>(null)
  const { addToast } = useToast()
  const metricas = calcularMetricasTestes()

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

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-10 min-h-screen">
      {/* Header */}
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
      </div>

      {/* KPIs */}
      <div className="flex items-center gap-8 mb-8">
        {[
          { label: 'Ativos',    value: metricas.testesAtivosHoje, color: '#22c55e' },
          { label: 'Expirando', value: metricas.testesExpirando,  color: '#f59e0b' },
          { label: 'Pagos',     value: metricas.testesPagos,      color: '#3b82f6' },
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
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['todos', 'ativo', 'sem_resposta', 'expirado', 'pago'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-3 h-10 rounded-xl text-xs font-medium transition-all"
                style={statusFilter === s
                  ? { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }
                  : { background: 'var(--card)', border: '1px solid var(--border)', color: '#64748b' }}>
                {s === 'todos' ? 'Todos' : STATUS_CFG[s].label}
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
            testesOrdenados.map(teste => (
              <TesteCard key={teste.id} teste={teste} onOpen={() => setSelectedTeste(teste)} />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Overlay + Drawer */}
      <AnimatePresence>
        {selectedTeste && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setSelectedTeste(null)}
            />
            <TesteDrawer
              key={selectedTeste.id}
              teste={selectedTeste}
              onClose={() => setSelectedTeste(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
