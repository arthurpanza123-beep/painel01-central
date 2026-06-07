'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { m as motion } from 'framer-motion'
import {
  Users, Search, Phone, Package, Server, Calendar, DollarSign,
  RefreshCw, Eye, Key, Tv2, Sparkles, X, Loader2,
} from 'lucide-react'
import {
  MOCK_CLIENTES,
  type Cliente,
  type StatusCliente,
} from '@/lib/mock-data'
import { StatusBadge } from '@/components/shared/status-badge'
import { ActionMenu, type ActionItem } from '@/components/shared/action-menu'
import { ClientDrawer } from '@/components/shared/client-drawer'
import { useToast } from '@/components/ui/toast'

const PLAN_OPTIONS = [
  { key: 'mensal', label: 'Mensal', months: 1 },
  { key: 'trimestral', label: 'Trimestral', months: 3 },
  { key: 'semestral', label: 'Semestral', months: 6 },
  { key: 'anual', label: 'Anual', months: 12 },
]

function normalizePlan(value: string) {
  const key = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return PLAN_OPTIONS.find((plan) => key.includes(plan.key))?.key || 'mensal'
}

function parseBrDate(value: string) {
  const [day, month, year] = value.split('/').map(Number)
  if (!day || !month || !year) return new Date()
  return new Date(year, month - 1, day, 12, 0, 0)
}

function addMonths(base: Date, months: number) {
  const next = new Date(base)
  const originalDate = next.getDate()
  next.setMonth(next.getMonth() + months)
  if (next.getDate() < originalDate) next.setDate(0)
  return next
}

function toInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatBrFromInput(value: string) {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function diasParaVencer(vencimento: string): number {
  const [d, m, a] = vencimento.split('/').map(Number)
  const alvo = new Date(a, m - 1, d)
  return Math.ceil((alvo.getTime() - Date.now()) / 86400000)
}

function Info({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] text-slate-600 uppercase tracking-wider">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-xs text-slate-300 truncate mt-0.5">{value}</p>
    </div>
  )
}

// ——— Card operacional do cliente ———
function ClienteCard({
  cliente,
  onVer,
  actions,
}: {
  cliente: Cliente
  onVer: () => void
  actions: ActionItem[]
}) {
  const dias = diasParaVencer(cliente.vencimento)
  const venceLabel =
    dias < 0 ? `Venceu ha ${Math.abs(dias)}d` : dias === 0 ? 'Vence hoje' : `Vence em ${dias}d`
  const venceColor = dias < 0 ? '#ef4444' : dias <= 3 ? '#f59e0b' : '#64748b'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 transition-all"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      {/* Topo: avatar + nome + status */}
      <div className="flex items-start gap-3 mb-4">
        <button
          onClick={onVer}
          className="h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}
        >
          {cliente.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={onVer} className="text-left">
            <h3 className="text-sm font-semibold text-white truncate hover:text-blue-400 transition-colors">
              {cliente.nome}
            </h3>
          </button>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
            <Phone className="h-3 w-3" /> {cliente.telefone}
          </div>
        </div>
        <StatusBadge status={cliente.status} dot />
      </div>

      {/* Grid de dados */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-4">
        <Info icon={Package} label="App" value={cliente.app} />
        <Info icon={Server} label="Servidor" value={cliente.servidor} />
        <Info icon={DollarSign} label="Plano" value={`${cliente.plano} · R$ ${cliente.valor.toFixed(0)}`} />
        <Info icon={Calendar} label="Vencimento" value={cliente.vencimento} />
      </div>

      {/* Rodape: status rapido + acoes */}
      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-[11px] font-medium" style={{ color: venceColor }}>{venceLabel}</span>
        <ActionMenu items={actions} />
      </div>
    </motion.div>
  )
}

function RenovarModal({
  cliente,
  busy,
  onClose,
  onConfirm,
}: {
  cliente: Cliente
  busy: boolean
  onClose: () => void
  onConfirm: (payload: { plan: string; amountCents: number; dueAt: string; note: string }) => void
}) {
  const initialPlan = normalizePlan(cliente.plano)
  const [plan, setPlan] = useState(initialPlan)
  const [amount, setAmount] = useState(String(cliente.valor || 20).replace('.', ','))
  const [note, setNote] = useState('')

  const predictedDueAt = useMemo(() => {
    const option = PLAN_OPTIONS.find((item) => item.key === plan) || PLAN_OPTIONS[0]
    return toInputDate(addMonths(parseBrDate(cliente.vencimento), option.months))
  }, [cliente.vencimento, plan])

  const amountNumber = Number(amount.replace(',', '.'))
  const canSubmit = Number.isFinite(amountNumber) && amountNumber > 0 && !busy

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(5,7,12,0.72)' }}>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start justify-between gap-4 p-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Renovacao</p>
            <h2 className="mt-1 text-lg font-semibold text-white truncate">{cliente.nome}</h2>
            <p className="text-xs text-slate-500 truncate">{cliente.app} · {cliente.servidor}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Plano atual</p>
              <p className="text-sm font-semibold text-white mt-1">{cliente.plano}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Vencimento atual</p>
              <p className="text-sm font-semibold text-white mt-1">{cliente.vencimento}</p>
            </div>
          </div>

          <label className="block">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Plano</span>
            <select
              value={plan}
              onChange={(event) => setPlan(event.target.value)}
              disabled={busy}
              className="mt-2 w-full h-11 rounded-xl px-3 text-sm text-white outline-none disabled:opacity-60"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
            >
              {PLAN_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Valor</span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={busy}
                inputMode="decimal"
                className="mt-2 w-full h-11 rounded-xl px-3 text-sm text-white outline-none disabled:opacity-60"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Novo vencimento</span>
              <input
                type="date"
                value={predictedDueAt}
                readOnly
                className="mt-2 w-full h-11 rounded-xl px-3 text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Observacao</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={busy}
              placeholder="Opcional"
              className="mt-2 w-full h-11 rounded-xl px-3 text-sm text-white placeholder:text-slate-600 outline-none disabled:opacity-60"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
            />
          </label>

          <button
            onClick={() => onConfirm({
              plan,
              amountCents: Math.round(amountNumber * 100),
              dueAt: predictedDueAt,
              note,
            })}
            disabled={!canSubmit}
            className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'rgba(59,130,246,0.16)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.28)' }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {busy ? 'Renovando...' : `Confirmar renovacao para ${formatBrFromInput(predictedDueAt)}`}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ——— Page ———
export function ClientesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusCliente | 'todos'>('todos')
  const [selecionado, setSelecionado] = useState<Cliente | null>(null)
  const [renovando, setRenovando] = useState<Cliente | null>(null)
  const [renovandoId, setRenovandoId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>(MOCK_CLIENTES)
  const [dataSource, setDataSource] = useState<'mock' | 'supabase'>('mock')
  const { addToast } = useToast()

  const loadClientes = useCallback(async (alive = true) => {
    try {
      const res = await fetch('/api/clients', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar clientes')
      const payload = await res.json()
      if (!alive) return
      setClientes(Array.isArray(payload.items) ? payload.items : MOCK_CLIENTES)
      setDataSource(payload.data_source === 'supabase' ? 'supabase' : 'mock')
    } catch {
      if (!alive) return
      setClientes(MOCK_CLIENTES)
      setDataSource('mock')
    }
  }, [])

  useEffect(() => {
    let alive = true
    loadClientes(alive)
    return () => { alive = false }
  }, [loadClientes])

  async function confirmarRenovacao(payload: { plan: string; amountCents: number; dueAt: string; note: string }) {
    if (!renovando || renovandoId) return

    const idempotencyKey = `renewal:${renovando.id}:${Date.now()}`
    setRenovandoId(renovando.id)
    try {
      const response = await fetch('/api/renewals/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: renovando.id,
          plan: payload.plan,
          amount_cents: payload.amountCents,
          due_at: payload.dueAt,
          note: payload.note || undefined,
          idempotency_key: idempotencyKey,
          operator_ref: 'painel_web',
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || 'Falha ao renovar cliente')
      }

      await loadClientes()
      setRenovando(null)
      addToast(
        result?.already_processed ? 'info' : 'success',
        result?.already_processed
          ? 'Renovacao ja processada. Nenhum lancamento duplicado.'
          : 'Renovacao registrada e mensagem enviada em background.'
      )
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Falha ao renovar cliente')
    } finally {
      setRenovandoId(null)
    }
  }

  const filtrados = clientes.filter((c) => {
    const s = search.toLowerCase()
    const matchSearch =
      !s || c.nome.toLowerCase().includes(s) || c.telefone.includes(search) || c.app.toLowerCase().includes(s)
    const matchStatus = statusFilter === 'todos' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const metricas = {
    total: clientes.length,
    ativos: clientes.filter((c) => c.status === 'ativo').length,
    expirados: clientes.filter((c) => c.status === 'expirado').length,
    receita: clientes.filter((c) => c.status === 'ativo').reduce((s, c) => s + c.valor, 0),
  }

  const buildActions = (c: Cliente): ActionItem[] => [
    { label: renovandoId === c.id ? 'Renovando...' : 'Renovar', icon: RefreshCw, onClick: () => {
      if (renovandoId === c.id) return
      setRenovando(c)
    }, color: '#60a5fa' },
    { label: 'Playlist / Credenciais', icon: Key, onClick: () => setSelecionado(c), color: '#14b8a6' },
    { label: 'Ativar segunda tela', icon: Tv2, onClick: () => {
      if (c.usuario) navigator.clipboard.writeText(c.usuario)
      const params = new URLSearchParams({ source: 'painel1', flow: 'second_screen', client_id: c.id, client_name: c.nome, app: c.app, panel: c.servidor })
      window.open(`https://painel2.centralplayplus.com.br?${params.toString()}`, '_blank')
      addToast('info', 'Usuario copiado e contexto enviado para Painel 2')
    }, color: '#f59e0b' },
    { label: 'Codex IA', icon: Sparkles, onClick: () => {
      navigator.clipboard.writeText(`Cliente: ${c.nome}\nTelefone: ${c.telefone}\nApp: ${c.app}\nServidor: ${c.servidor}\nPlano: ${c.plano}\nVencimento: ${c.vencimento}\n\nProblema/Pergunta:`)
      addToast('success', 'Contexto copiado para Codex IA')
    }, color: '#14b8a6' },
    { label: 'Ver dados', icon: Eye, onClick: () => setSelecionado(c) },
  ]

  return (
    <>
      <div className="flex-1 flex flex-col items-center px-6 py-10 min-h-screen">
        {/* Header */}
        <div className="text-center mb-8 max-w-xl">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Users className="h-4 w-4" style={{ color: '#60a5fa' }} />
            <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">CRM</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>Clientes</h1>
          <p className="text-slate-500 text-sm">
            {metricas.total} clientes · {metricas.ativos} ativos · R$ {metricas.receita.toFixed(0)} ativos/mes
          </p>
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-8 mb-8">
          {[
            { label: 'Total', value: metricas.total, color: '#60a5fa' },
            { label: 'Ativos', value: metricas.ativos, color: '#22c55e' },
            { label: 'Expirados', value: metricas.expirados, color: '#ef4444' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-xl font-bold" style={{ color, fontFamily: 'var(--font-display)' }}>{value}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* Busca + filtros */}
        <div className="w-full max-w-4xl mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por nome, telefone ou app..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-12 pl-12 pr-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['todos', 'ativo', 'expirado', 'pendente'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-3 h-12 rounded-xl text-xs font-medium transition-all capitalize"
                  style={
                    statusFilter === s
                      ? { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }
                      : { background: 'var(--card)', border: '1px solid var(--border)', color: '#64748b' }
                  }
                >
                  {s === 'todos' ? 'Todos' : s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid de cards */}
        <div className="w-full max-w-4xl">
          {filtrados.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <Users className="h-10 w-10 mx-auto mb-3" style={{ color: '#1e293b' }} />
              <p className="text-slate-500 text-sm">Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtrados.map((c) => (
                <ClienteCard key={c.id} cliente={c} onVer={() => setSelecionado(c)} actions={buildActions(c)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <ClientDrawer
        cliente={selecionado}
        onClose={() => setSelecionado(null)}
        onRenovar={(c) => {
          if (renovandoId === c.id) return
          setRenovando(c)
        }}
      />
      {renovando && (
        <RenovarModal
          cliente={renovando}
          busy={renovandoId === renovando.id}
          onClose={() => {
            if (!renovandoId) setRenovando(null)
          }}
          onConfirm={confirmarRenovacao}
        />
      )}
    </>
  )
}
