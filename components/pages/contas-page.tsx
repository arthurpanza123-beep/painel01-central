'use client'

import { useEffect, useState } from 'react'
import { m as motion, AnimatePresence } from 'framer-motion'
import {
  Search, Layers, Copy, X, UserPlus, Calendar,
  Server, KeyRound, Check, Plus, MessageCircle, Tv2,
} from 'lucide-react'
import {
  MOCK_CLIENTES,
  MOCK_CONTAS,
  type Conta,
  type Cliente,
} from '@/lib/mock-data'
import { AccountGroupCard } from '@/components/shared/account-group-card'
import { useToast } from '@/components/ui/toast'
import { buildProviderCredentials, getProviderPanelUrl, listCompatibleApps } from '@/lib/config/provider-catalog'

type TelaTarget = { conta: Conta; index: number }
type ActivationRecommendation = {
  recommended: boolean
  reason: string
  account_id: string | null
  account_label: string | null
  slot_id: string | null
  slot_number: number | null
  slot_label: string | null
  requires_new_account: boolean
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(7,10,18,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

// ——— Modal: Ativar cliente que pagou em tela livre ———
function AtivarModal({
  target, onClose, onConfirm,
  candidatos,
}: {
  target: TelaTarget
  onClose: () => void
  onConfirm: (cliente: Cliente, recommendation: ActivationRecommendation | null) => Promise<void>
  candidatos: Cliente[]
}) {
  const { conta } = target
  const { addToast } = useToast()
  const [clienteId, setClienteId] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [recommendation, setRecommendation] = useState<ActivationRecommendation | null>(null)
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [recommendationError, setRecommendationError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Clientes que pagaram (ativos/pendentes) disponiveis para vincular
  const listaClientes = candidatos.filter(
    (c) => c.nome.toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca)
  )
  const selecionado = candidatos.find((c) => c.id === clienteId)

  useEffect(() => {
    let alive = true
    async function loadRecommendation() {
      if (!selecionado) {
        setRecommendation(null)
        setRecommendationError('')
        return
      }
      setRecommendationLoading(true)
      setRecommendationError('')
      try {
        const params = new URLSearchParams({
          client_id: selecionado.id,
          account_id: conta.id,
          slot_number: String(target.index + 1),
        })
        const res = await fetch(`/api/activations/recommendation?${params.toString()}`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        if (!alive) return
        setRecommendation(data)
      } catch (err) {
        if (!alive) return
        setRecommendation(null)
        setRecommendationError(err instanceof Error ? err.message : 'Falha ao buscar recomendacao')
      } finally {
        if (alive) setRecommendationLoading(false)
      }
    }
    loadRecommendation()
    return () => { alive = false }
  }, [selecionado, conta.id, target.index])

  const gerarMensagem = () => {
    if (!selecionado) return
    navigator.clipboard.writeText(
      `Ola ${selecionado.nome}! Seu acesso foi ativado.\nApp: ${conta.app}\nServidor: ${conta.servidor}\nUsuario: ${conta.usuario}\nSenha: ${conta.senha}`
    )
    addToast('success', 'Mensagem final copiada')
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="p-5 text-center" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
          <UserPlus className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>Usar tela</h3>
        <p className="text-xs text-slate-500 mt-1">Tela {target.index + 1} · Conta {conta.codigo}</p>
      </div>

      <div className="p-5 space-y-4">
        {/* 1. Escolher cliente que pagou */}
        <div>
          <label className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 block">1. Cliente que pagou</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full h-9 pl-9 pr-3 rounded-lg text-sm text-white placeholder:text-slate-600 outline-none"
              style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {listaClientes.map((c) => (
              <button
                key={c.id}
                onClick={() => setClienteId(c.id)}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-all"
                style={{
                  background: clienteId === c.id ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)',
                  border: clienteId === c.id ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border)',
                }}
              >
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                  {c.nome.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{c.nome}</p>
                  <p className="text-[10px] text-slate-500">{c.telefone}</p>
                </div>
                {clienteId === c.id && <Check className="h-4 w-4 shrink-0" style={{ color: '#60a5fa' }} />}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Confirmar app/servidor */}
        <div>
          <label className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 block">2. Confirmar acesso</label>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
              <Tv2 className="h-3.5 w-3.5 text-slate-500" />
              <div><p className="text-[9px] text-slate-600 uppercase">App</p><p className="text-xs text-slate-200">{conta.app}</p></div>
            </div>
            <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
              <Server className="h-3.5 w-3.5 text-slate-500" />
              <div><p className="text-[9px] text-slate-600 uppercase">Servidor</p><p className="text-xs text-slate-200">{conta.servidor}</p></div>
            </div>
          </div>
        </div>

        {selecionado && (
          <div>
            <label className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 block">3. Recomendacao de tela</label>
            <div className="rounded-lg p-3 text-left" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
              {recommendationLoading ? (
                <p className="text-xs text-slate-400">Buscando melhor tela...</p>
              ) : recommendationError ? (
                <p className="text-xs text-red-300">{recommendationError}</p>
              ) : recommendation ? (
                <>
                  <p className="text-xs font-semibold" style={{ color: recommendation.requires_new_account ? '#f59e0b' : '#4ade80' }}>
                    {recommendation.requires_new_account
                      ? 'Nenhuma tela livre. Sera necessario criar nova conta.'
                      : `Melhor opcao: usar tela livre na conta ${recommendation.account_label || conta.codigo}`}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">{recommendation.reason}</p>
                  {recommendation.slot_label && <p className="text-[11px] text-slate-400 mt-2">Tela recomendada: {recommendation.slot_label}</p>}
                </>
              ) : (
                <p className="text-xs text-slate-500">Selecione um cliente para calcular a tela.</p>
              )}
            </div>
          </div>
        )}

        {/* 3. Gerar mensagem */}
        {selecionado && (
          <button
            onClick={gerarMensagem}
            className="w-full h-9 rounded-lg text-xs font-medium flex items-center justify-center gap-2"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <MessageCircle className="h-3.5 w-3.5" /> Gerar mensagem final
          </button>
        )}
      </div>

      <div className="p-5 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          disabled={!selecionado || submitting || recommendationLoading || Boolean(recommendationError) || Boolean(recommendation?.requires_new_account)}
          onClick={async () => {
            if (!selecionado) return
            setSubmitting(true)
            try {
              await onConfirm(selecionado, recommendation)
            } finally {
              setSubmitting(false)
            }
          }}
          className="flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          style={{ background: '#22c55e', color: '#06140a' }}
        >
          <Check className="h-4 w-4" /> {submitting ? 'Ativando...' : 'Usar esta tela'}
        </button>
        <button onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-medium flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: '#94a3b8' }}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </ModalShell>
  )
}

// ——— Modal: Credenciais ———
function CredenciaisModal({ conta, onClose }: { conta: Conta; onClose: () => void }) {
  const { addToast } = useToast()
  const providerPanelUrl = getProviderPanelUrl(conta.servidor)
  const compatibleApps = listCompatibleApps(conta.servidor).slice(0, 8)
  const selectedCredential = (() => {
    try {
      return buildProviderCredentials({
        provider: conta.servidor,
        app: conta.app,
        username: conta.usuario,
        password: conta.senha,
      })
    } catch {
      return null
    }
  })()
  const handleCopy = () => {
    const txt = [
      `Conta: ${conta.codigo}`,
      `App: ${conta.app}`,
      selectedCredential?.providerCode ? `Provider: ${selectedCredential.providerCode}` : null,
      selectedCredential?.code ? `Codigo: ${selectedCredential.code}` : null,
      selectedCredential?.dns ? `DNS: ${selectedCredential.dns}` : null,
      `Usuario: ${conta.usuario}`,
      `Senha: ${conta.senha}`,
      `Servidor: ${conta.servidor}`,
      `Validade: ${conta.vencimento}`,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(txt)
    addToast('success', 'Credenciais copiadas')
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="p-5 text-center" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(20,184,166,0.12)', color: '#14b8a6' }}>
          <KeyRound className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>{conta.codigo}</h3>
        <p className="text-xs text-slate-500 mt-1">{conta.app} · {conta.servidor}</p>
      </div>
      <div className="p-5 space-y-3">
        {[
          { label: 'Usuario', value: conta.usuario },
          { label: 'Senha', value: conta.senha },
          { label: 'Servidor', value: conta.servidor },
          selectedCredential?.providerCode ? { label: 'Provider', value: selectedCredential.providerCode } : null,
          selectedCredential?.code ? { label: 'Codigo', value: selectedCredential.code } : null,
          selectedCredential?.dns ? { label: 'DNS', value: selectedCredential.dns } : null,
          { label: 'Validade', value: conta.vencimento },
        ].filter((item): item is { label: string; value: string } => Boolean(item)).map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs text-slate-500">{label}</span>
            <span className="text-sm text-white font-mono">{value}</span>
          </div>
        ))}
        {compatibleApps.length > 0 && (
          <div className="pt-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Apps compativeis</p>
            <div className="flex flex-wrap gap-2">
              {compatibleApps.map((app) => (
                <span key={app.key} className="rounded-lg px-2 py-1 text-[11px]" style={{ background: app.recommended ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', color: app.recommended ? '#4ade80' : '#94a3b8', border: '1px solid var(--border)' }}>
                  {app.name}{app.providerCode ? ` · ${app.providerCode}` : app.code ? ` · ${app.code}` : app.dns ? ` · ${app.dns}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="p-5 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={handleCopy} className="flex-1 h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}>
          <Copy className="h-4 w-4" /> Copiar
        </button>
        {providerPanelUrl && (
          <button onClick={() => window.open(providerPanelUrl, '_blank')} className="h-10 px-3 rounded-xl text-sm font-medium flex items-center justify-center" style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.25)', color: '#2dd4bf' }}>
            Painel
          </button>
        )}
        <button onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-medium flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: '#94a3b8' }}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </ModalShell>
  )
}

// ——— Page ———
export function ContasPage() {
  const [search, setSearch] = useState('')
  const [contas, setContas] = useState<Conta[]>(MOCK_CONTAS)
  const [clientes, setClientes] = useState<Cliente[]>(MOCK_CLIENTES)
  const [dataSource, setDataSource] = useState<'mock' | 'supabase'>('mock')
  const [credenciais, setCredenciais] = useState<Conta | null>(null)
  const [ativarTarget, setAtivarTarget] = useState<TelaTarget | null>(null)
  const { addToast } = useToast()

  async function carregarDados(alive = true) {
    try {
      const [accountsRes, clientsRes] = await Promise.all([
        fetch('/api/accounts', { cache: 'no-store' }),
        fetch('/api/clients', { cache: 'no-store' }),
      ])
      if (!accountsRes.ok || !clientsRes.ok) throw new Error('Falha ao carregar contas')
      const accountsPayload = await accountsRes.json()
      const clientsPayload = await clientsRes.json()
      if (!alive) return
      setContas(Array.isArray(accountsPayload.items) ? accountsPayload.items : MOCK_CONTAS)
      setClientes(Array.isArray(clientsPayload.items) ? clientsPayload.items : MOCK_CLIENTES)
      setDataSource(accountsPayload.data_source === 'supabase' && clientsPayload.data_source === 'supabase' ? 'supabase' : 'mock')
    } catch {
      if (!alive) return
      setContas(MOCK_CONTAS)
      setClientes(MOCK_CLIENTES)
      setDataSource('mock')
    }
  }

  useEffect(() => {
    let alive = true
    carregarDados(alive)
    return () => { alive = false }
  }, [])

  const vagasTotais = contas.reduce((acc, c) => acc + c.vagasTotal, 0)
  const vagasOcupadas = contas.reduce((acc, c) => acc + c.clientesVinculados.length, 0)
  const metricas = {
    totalContas: contas.length,
    vagasLivres: vagasTotais - vagasOcupadas,
    vagasTotais,
    contasComVaga: contas.filter((c) => c.clientesVinculados.length < c.vagasTotal).length,
    contasCompletas: contas.filter((c) => c.clientesVinculados.length >= c.vagasTotal).length,
  }

  const contasFiltradas = contas.filter((c) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      c.clientePrincipal.toLowerCase().includes(s) ||
      c.codigo.toLowerCase().includes(s) ||
      c.usuario.toLowerCase().includes(s) ||
      c.app.toLowerCase().includes(s) ||
      c.servidor.toLowerCase().includes(s) ||
      c.clientesVinculados.some((v) => v.nome.toLowerCase().includes(s))
    )
  })

  const contasOrdenadas = [...contasFiltradas].sort((a, b) => {
    const vagasLivresA = a.vagasTotal - a.clientesVinculados.length
    const vagasLivresB = b.vagasTotal - b.clientesVinculados.length
    if (vagasLivresA > 0 && vagasLivresB === 0) return -1
    if (vagasLivresA === 0 && vagasLivresB > 0) return 1
    if (vagasLivresA > 0 && vagasLivresB > 0) {
      return a.clientesVinculados.length - b.clientesVinculados.length
    }
    return 0
  })

  const confirmarAtivacao = async (cliente: Cliente, recommendation: ActivationRecommendation | null) => {
    if (!ativarTarget) return
    const { conta } = ativarTarget
    try {
      const res = await fetch('/api/activations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: cliente.id,
          account_id: recommendation?.account_id || conta.id,
          slot_id: recommendation?.slot_id || undefined,
          slot_number: recommendation?.slot_number || ativarTarget.index + 1,
          plan_key: cliente.plano?.toLowerCase() || 'mensal',
          amount: cliente.valor || 35,
          due_at: cliente.vencimento,
          operator_ref: 'painel_web',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`)
      addToast('success', `${cliente.nome} ativado na ${data.activation.slot_label} da conta ${data.activation.account_label}`)
      setAtivarTarget(null)
      await carregarDados()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Falha ao ativar cliente')
    }
  }

  return (
    <>
      <div className="flex-1 flex flex-col items-center px-6 py-10 min-h-screen">
        {/* Header */}
        <div className="text-center mb-8 max-w-xl">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Layers className="h-4 w-4" style={{ color: '#14b8a6' }} />
            <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Contas & Telas</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>Contas</h1>
          <p className="text-slate-500 text-sm">
            {metricas.totalContas} grupos úteis · {metricas.vagasLivres} telas livres de {metricas.vagasTotais}
          </p>
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-8 mb-8">
          {[
            { label: 'Contas', value: metricas.totalContas, color: '#14b8a6' },
            { label: 'Com tela', value: metricas.contasComVaga, color: '#22c55e' },
            { label: 'Cheias', value: metricas.contasCompletas, color: '#f59e0b' },
            { label: 'Telas livres', value: metricas.vagasLivres, color: '#60a5fa' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-xl font-bold" style={{ color, fontFamily: 'var(--font-display)' }}>{value}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* Busca + criar conta */}
        <div className="w-full max-w-2xl mb-6 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por codigo, cliente, usuario ou app..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            />
          </div>
          <button
            onClick={() => addToast('info', 'Formulario de nova conta em breve')}
            className="h-12 px-4 rounded-xl text-sm font-medium flex items-center gap-2 shrink-0 transition-all"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}
          >
            <Plus className="h-4 w-4" /> Nova conta
          </button>
        </div>

        {/* Lista */}
        <div className="w-full max-w-2xl space-y-3">
          {contasOrdenadas.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <Layers className="h-10 w-10 mx-auto mb-3" style={{ color: '#1e293b' }} />
              <p className="text-slate-500 text-sm">Nenhuma conta encontrada</p>
            </div>
          ) : (
            contasOrdenadas.map((conta) => {
              const temVagaLivre = conta.clientesVinculados.length < conta.vagasTotal
              return (
                <AccountGroupCard
                  key={conta.id}
                  conta={conta}
                  destacar={temVagaLivre}
                  onAtivar={(index) => setAtivarTarget({ conta, index })}
                  onCredenciais={() => setCredenciais(conta)}
                />
              )
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {credenciais && <CredenciaisModal conta={credenciais} onClose={() => setCredenciais(null)} />}
        {ativarTarget && (
          <AtivarModal target={ativarTarget} candidatos={clientes} onClose={() => setAtivarTarget(null)} onConfirm={confirmarAtivacao} />
        )}
      </AnimatePresence>
    </>
  )
}
