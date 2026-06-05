'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, ChevronRight, Search, UserPlus, Users, Zap } from 'lucide-react'

import { useToast } from '@/components/ui/toast'
import { getProviderPanelUrl, listCompatibleApps } from '@/lib/config/provider-catalog'
import type { Cliente } from '@/lib/mock-data'

type Step = 'busca' | 'app_plano' | 'confirmar'
type Recommendation = {
  recommended: boolean
  reason: string
  account_id: string | null
  account_label: string | null
  slot_id: string | null
  slot_number: number | null
  slot_label: string | null
  requires_new_account: boolean
  app_id: string | null
  panel_id: string | null
}

const APPS = [
  { id: 'xcloud', label: 'XCloud', color: '#14b8a6' },
  { id: 'blessed', label: 'Blessed Player', color: '#ef4444' },
  { id: 'playsim', label: 'PlaySim', color: '#f97316' },
  { id: 'funplay', label: 'FunPlay', color: '#8b5cf6' },
  { id: 'magic_player', label: 'Magic Player', color: '#a855f7' },
  { id: 'xciptv', label: 'XCIPTV', color: '#06b6d4' },
  { id: 'smarters', label: 'Smarters', color: '#38bdf8' },
  { id: 'smart_stb', label: 'Smart STB', color: '#3b82f6' },
]

const PAINEIS = [
  { id: 'yellow', label: 'Yellow Box' },
  { id: 'yellow_x3', label: 'Yellow X3' },
  { id: 'ninety', label: 'Ninety' },
  { id: 'cinemax', label: 'CineMax' },
  { id: 'xbr', label: 'XBR / DevXTop' },
  { id: 'areaplay', label: 'AreaPlay / Sigma' },
]

const PANEL_PROVIDER_LOOKUP: Record<string, string> = {
  yellow: 'Yellow Box',
  yellow_x3: 'Yellow Box X3 / Antigo',
  ninety: 'Ninety',
  cinemax: 'CineMax',
  xbr: 'XBR / DevXTop',
  areaplay: 'AreaPlay / Sigma',
}

const PLANOS = [
  { id: 'mensal', label: 'Mensal', valor: 20 },
  { id: 'trimestral', label: 'Trimestral', valor: 50 },
  { id: 'semestral', label: 'Semestral', valor: 90 },
  { id: 'anual', label: 'Anual', valor: 150 },
]

export function AtivarClientesPage() {
  const [step, setStep] = useState<Step>('busca')
  const [search, setSearch] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [novoCliente, setNovoCliente] = useState({ name: '', phone: '' })
  const [appKey, setAppKey] = useState('xcloud')
  const [panelKey, setPanelKey] = useState('yellow')
  const [planKey, setPlanKey] = useState('mensal')
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [loadingRecommendation, setLoadingRecommendation] = useState(false)
  const [ativando, setAtivando] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch('/api/clients', { cache: 'no-store' })
        const payload = await res.json()
        if (!alive) return
        setClientes(Array.isArray(payload.items) ? payload.items : [])
      } catch {
        if (alive) setClientes([])
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const clientesFiltrados = useMemo(() => {
    const s = search.toLowerCase().trim()
    if (!s) return []
    return clientes.filter((cliente) =>
      cliente.nome.toLowerCase().includes(s) ||
      cliente.telefone.includes(search) ||
      cliente.usuario.toLowerCase().includes(s)
    )
  }, [clientes, search])

  const plano = PLANOS.find((item) => item.id === planKey) || PLANOS[0]
  const valorFinal = clienteSelecionado && clienteSelecionado.valor > 0 ? clienteSelecionado.valor : plano.valor
  const selectedClientName = clienteSelecionado?.nome || novoCliente.name || search
  const selectedClientPhone = clienteSelecionado?.telefone || novoCliente.phone
  const providerLookup = PANEL_PROVIDER_LOOKUP[panelKey] || panelKey
  const providerPanelUrl = getProviderPanelUrl(providerLookup)
  const compatibleApps = listCompatibleApps(providerLookup).slice(0, 8)

  async function carregarRecomendacao(nextApp = appKey, nextPanel = panelKey) {
    setRecommendation(null)
    if (!clienteSelecionado?.id) return
    setLoadingRecommendation(true)
    try {
      const params = new URLSearchParams({
        app_key: nextApp,
        panel_key: nextPanel,
        ...(clienteSelecionado?.id ? { client_id: clienteSelecionado.id } : {}),
        ...(!clienteSelecionado?.id ? { client: novoCliente.name } : {}),
      })
      const res = await fetch(`/api/activations/recommendation?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`)
      setRecommendation(data)
    } catch (err) {
      setRecommendation(null)
      addToast('error', err instanceof Error ? err.message : 'Falha ao buscar recomendacao')
    } finally {
      setLoadingRecommendation(false)
    }
  }

  function selecionarCliente(cliente: Cliente) {
    setClienteSelecionado(cliente)
    setNovoCliente({ name: '', phone: '' })
    setAppKey(appIdFromName(cliente.app) || 'xcloud')
    setPanelKey(panelIdFromName(cliente.servidor) || 'yellow')
    setPlanKey(planIdFromName(cliente.plano) || 'mensal')
    setStep('app_plano')
  }

  function criarNovo() {
    setClienteSelecionado(null)
    setNovoCliente({ name: search, phone: '' })
    setStep('app_plano')
  }

  async function confirmar() {
    if (!selectedClientName || !selectedClientPhone) {
      addToast('error', 'Informe nome e telefone do cliente')
      return
    }
    if (!recommendation) await carregarRecomendacao()
    setStep('confirmar')
  }

  async function ativarCliente() {
    setAtivando(true)
    try {
      const res = await fetch('/api/activations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(clienteSelecionado?.id ? { client_id: clienteSelecionado.id } : { client: { name: selectedClientName, phone: selectedClientPhone } }),
          app_key: appKey,
          panel_key: panelKey,
          plan_key: planKey,
          amount: valorFinal,
          account_id: recommendation?.account_id || undefined,
          slot_id: recommendation?.slot_id || undefined,
          slot_number: recommendation?.slot_number || undefined,
          operator_ref: 'painel_web',
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`)
      addToast('success', 'Cliente ativado com sucesso')
      const params = new URLSearchParams({
        source: 'painel1',
        flow: 'access_activated',
        client_id: data.activation?.client_id || clienteSelecionado?.id || '',
        client_name: selectedClientName,
        app: APPS.find((item) => item.id === appKey)?.label || appKey,
        panel: PAINEIS.find((item) => item.id === panelKey)?.label || panelKey,
        plan: plano.label,
        amount: String(valorFinal),
      })
      window.open(`https://painel2.centralplayplus.com.br?${params.toString()}`, '_blank')
      setStep('busca')
      setSearch('')
      setClienteSelecionado(null)
      setNovoCliente({ name: '', phone: '' })
      setRecommendation(null)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Falha ao ativar cliente')
    } finally {
      setAtivando(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-10 min-h-screen">
      <div className="text-center mb-8 max-w-xl">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Zap className="h-4 w-4" style={{ color: '#22c55e' }} />
          <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Ativacao</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>Ativar clientes</h1>
        <p className="text-slate-500 text-sm">Ative clientes pagos usando vagas reais e slots disponiveis</p>
      </div>

      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {step === 'busca' && (
            <motion.div key="busca" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente por nome, telefone ou usuario..." className="w-full h-14 pl-14 pr-4 rounded-2xl text-base text-white placeholder:text-slate-600 outline-none" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                {search ? clientesFiltrados.slice(0, 6).map((cliente) => (
                  <button key={cliente.id} onClick={() => selecionarCliente(cliente)} className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.03] transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>{cliente.nome.slice(0, 2).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{cliente.nome}</p>
                      <p className="text-xs text-slate-500">{cliente.telefone} · {cliente.app} · R$ {cliente.valor || 0}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-600" />
                  </button>
                )) : (
                  <div className="p-10 text-center">
                    <Users className="h-10 w-10 mx-auto mb-3" style={{ color: '#1e293b' }} />
                    <p className="text-slate-500 text-sm">Pesquise um cliente existente</p>
                  </div>
                )}
                <div className="p-4">
                  <button onClick={criarNovo} className="w-full h-12 rounded-xl text-sm font-medium flex items-center justify-center gap-2" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
                    <UserPlus className="h-4 w-4" /> Criar novo cliente
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'app_plano' && (
            <motion.div key="app" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
              <Panel title="Cliente">
                {clienteSelecionado ? (
                  <div>
                    <p className="text-sm font-semibold text-white">{clienteSelecionado.nome}</p>
                    <p className="text-xs text-slate-500">{clienteSelecionado.telefone}</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={novoCliente.name} onChange={(event) => setNovoCliente(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome" className="h-10 rounded-lg px-3 text-sm text-white outline-none" style={{ background: 'var(--input)', border: '1px solid var(--border)' }} />
                    <input value={novoCliente.phone} onChange={(event) => setNovoCliente(prev => ({ ...prev, phone: event.target.value }))} placeholder="Telefone" className="h-10 rounded-lg px-3 text-sm text-white outline-none" style={{ background: 'var(--input)', border: '1px solid var(--border)' }} />
                  </div>
                )}
              </Panel>
              <Picker title="Aplicativo" items={APPS} value={appKey} onChange={(value) => { setAppKey(value); carregarRecomendacao(value, panelKey) }} />
              <Picker title="Painel gerador" items={PAINEIS.map(p => ({ ...p, color: '#60a5fa' }))} value={panelKey} onChange={(value) => { setPanelKey(value); carregarRecomendacao(appKey, value) }} />
              <Panel title="Catalogo do painel">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {compatibleApps.length ? compatibleApps.map((app) => (
                      <span key={app.key} className="rounded-lg px-2 py-1 text-[11px]" style={{ background: app.recommended ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', color: app.recommended ? '#4ade80' : '#94a3b8', border: '1px solid var(--border)' }}>
                        {app.name}{app.providerCode ? ` · Provider ${app.providerCode}` : app.code ? ` · Codigo ${app.code}` : app.dns ? ` · DNS ${app.dns}` : ''}
                      </span>
                    )) : <p className="text-xs text-slate-500">Nenhum app catalogado para este painel.</p>}
                  </div>
                  {providerPanelUrl && (
                    <button onClick={() => window.open(providerPanelUrl, '_blank')} className="h-9 px-3 rounded-xl text-xs font-medium" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}>
                      Abrir painel do provedor
                    </button>
                  )}
                </div>
              </Panel>
              <Picker title="Plano" items={PLANOS.map(p => ({ id: p.id, label: `${p.label} · R$ ${p.valor}`, color: '#22c55e' }))} value={planKey} onChange={setPlanKey} />
              {clienteSelecionado && clienteSelecionado.valor > 0 && clienteSelecionado.valor !== plano.valor && (
                <div className="rounded-xl p-3 text-xs text-amber-200" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  Valor antigo preservado: R$ {clienteSelecionado.valor}. Plano oficial selecionado: R$ {plano.valor}.
                </div>
              )}
              <button onClick={confirmar} className="w-full h-12 rounded-xl text-sm font-semibold text-white" style={{ background: '#2563eb' }}>Continuar</button>
            </motion.div>
          )}

          {step === 'confirmar' && (
            <motion.div key="confirmar" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
              <Panel title="Confirmacao">
                <div className="space-y-2 text-sm">
                  <Row label="Cliente" value={selectedClientName} />
                  <Row label="App" value={APPS.find(item => item.id === appKey)?.label || appKey} />
                  <Row label="Painel" value={PAINEIS.find(item => item.id === panelKey)?.label || panelKey} />
                  <Row label="Plano" value={plano.label} />
                  <Row label="Valor" value={`R$ ${valorFinal}`} />
                </div>
              </Panel>
              <Panel title="Catalogo aplicado">
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Apps compativeis serao montados pelo catalogo do provedor, sem codigo generico.</p>
                  {providerPanelUrl && <Row label="Painel do provedor" value={providerPanelUrl} />}
                </div>
              </Panel>
              <Panel title="Recomendacao de vaga">
                {loadingRecommendation ? <p className="text-sm text-slate-500">Buscando vaga livre...</p> : recommendation ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold" style={{ color: recommendation.recommended ? '#4ade80' : '#fbbf24' }}>
                      {recommendation.recommended ? 'Vaga livre encontrada' : 'Sem vaga livre compativel'}
                    </p>
                    <p className="text-xs text-slate-500">{recommendation.reason}</p>
                    {recommendation.recommended && <p className="text-xs text-emerald-300">Usar {recommendation.slot_label} em {recommendation.account_label}</p>}
                  </div>
                ) : <p className="text-sm text-slate-500">Nenhuma recomendacao carregada.</p>}
              </Panel>
              <div className="grid gap-2 sm:grid-cols-2">
                <button disabled={ativando} onClick={ativarCliente} className="h-12 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#22c55e' }}>
                  {ativando ? 'Ativando...' : 'Confirmar ativacao real'}
                </button>
                <button onClick={() => setStep('app_plano')} className="h-12 rounded-xl text-sm font-medium text-slate-400" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>Voltar</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function appIdFromName(value: string) {
  const normalized = value.toLowerCase()
  return APPS.find((app) => normalized.includes(app.id) || normalized.includes(app.label.toLowerCase()))?.id
}

function panelIdFromName(value: string) {
  const normalized = value.toLowerCase()
  if (normalized.includes('x3')) return 'yellow_x3'
  if (normalized.includes('area') || normalized.includes('sigma')) return 'areaplay'
  if (normalized.includes('devx') || normalized.includes('xbr')) return 'xbr'
  return PAINEIS.find((panel) => normalized.includes(panel.id) || normalized.includes(panel.label.toLowerCase()))?.id
}

function planIdFromName(value: string) {
  const normalized = value.toLowerCase()
  return PLANOS.find((plan) => normalized.includes(plan.id) || normalized.includes(plan.label.toLowerCase()))?.id
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}><h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>{children}</div>
}

function Picker({ title, items, value, onChange }: { title: string; items: { id: string; label: string; color: string }[]; value: string; onChange: (value: string) => void }) {
  return (
    <Panel title={title}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <button key={item.id} onClick={() => onChange(item.id)} className="rounded-xl p-3 text-sm font-semibold transition-all" style={{ background: value === item.id ? `${item.color}18` : 'rgba(255,255,255,0.02)', border: value === item.id ? `1px solid ${item.color}` : '1px solid var(--border)', color: value === item.id ? item.color : '#94a3b8' }}>
            {item.label}
          </button>
        ))}
      </div>
    </Panel>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-slate-500">{label}</span><span className="font-semibold text-white">{value}</span></div>
}
