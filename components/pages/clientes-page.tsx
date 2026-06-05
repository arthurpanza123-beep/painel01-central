'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Search, Phone, Package, Server, Calendar, DollarSign,
  MessageCircle, RefreshCw, UserCheck, Repeat, Eye, Copy, Bug,
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

// ——— Page ———
export function ClientesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusCliente | 'todos'>('todos')
  const [selecionado, setSelecionado] = useState<Cliente | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>(MOCK_CLIENTES)
  const [dataSource, setDataSource] = useState<'mock' | 'supabase'>('mock')
  const { addToast } = useToast()

  useEffect(() => {
    let alive = true
    async function load() {
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
    }
    load()
    return () => { alive = false }
  }, [])

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

  const whats = (c: Cliente) => {
    window.open(`https://wa.me/55${c.telefone.replace(/\D/g, '')}`, '_blank')
    addToast('success', 'Abrindo WhatsApp...')
  }

  const buildActions = (c: Cliente): ActionItem[] => [
    { label: 'Abrir WhatsApp', icon: MessageCircle, onClick: () => whats(c), color: '#4ade80' },
    { label: 'Renovar', icon: RefreshCw, onClick: () => addToast('success', `Renovacao de ${c.nome} iniciada`), color: '#60a5fa' },
    { label: 'Ativar cliente', icon: UserCheck, onClick: () => addToast('success', `${c.nome} ativado`) },
    { label: 'Trocar aplicativo', icon: Repeat, onClick: () => addToast('info', 'Selecione o novo app') },
    { label: 'Trocar servidor', icon: Server, onClick: () => addToast('info', 'Selecione o novo servidor') },
    { label: 'Debugar problema', icon: Bug, onClick: () => addToast('info', 'Abrindo suporte tecnico'), color: '#a78bfa' },
    { label: 'Ver dados', icon: Eye, onClick: () => setSelecionado(c) },
    {
      label: 'Copiar mensagem', icon: Copy, onClick: () => {
        navigator.clipboard.writeText(`Ola ${c.nome}! Seu acesso ${c.app} (${c.servidor}) vence em ${c.vencimento}.`)
        addToast('success', 'Mensagem copiada')
      },
    },
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
          <p className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
             style={{ background: dataSource === 'supabase' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: dataSource === 'supabase' ? '#4ade80' : '#fbbf24' }}>
            Fonte: {dataSource === 'supabase' ? 'Supabase' : 'Mock'}
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
        onWhatsApp={whats}
        onRenovar={(c) => addToast('success', `Renovacao de ${c.nome} iniciada`)}
      />
    </>
  )
}
