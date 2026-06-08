'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, RefreshCw, Copy, Eye, EyeOff, ExternalLink, Loader2,
  User, Phone, Package, Server, Calendar, KeyRound, AlertTriangle, History,
  Bot, Send, Sparkles, ClipboardList, Save, Bug, MessageSquare,
} from 'lucide-react'
import type { Cliente } from '@/lib/mock-data'
import { StatusBadge } from './status-badge'
import { useToast } from '@/components/ui/toast'
import {
  OFFICIAL_PLANS,
  formatCurrencyBRLFromCents,
  normalizePlanKey,
  normalizeScreensCount,
  officialPlan,
  type ScreensCount,
} from '@/lib/services/official-plans'

type CatalogAppCredential = {
  app: string
  appKey: string
  providerCode?: string
  code?: string
  username?: string
  password?: string
  host?: string
  dns?: string
  m3uUrl?: string
  hlsUrl?: string
  link?: string
  downloader?: string
  installHint?: string
  credentialText: string
}

type ClientCredentialsPayload = {
  success: boolean
  client?: {
    id: string
    name?: string | null
    phone_e164?: string | null
    status?: string | null
    legacy_metadata?: Record<string, unknown> | null
  }
  provider: { key: string; name: string; panelUrl: string } | null
  account: {
    id?: string
    username?: string
    password?: string
    host?: string
    m3u?: string
    hls?: string
    hasSlot?: boolean
    expiresAt?: string | null
  } | null
  selectedApp?: { key: string; name: string } | null
  plan?: { key?: string | null; amountCents?: number | null; dueAt?: string | null; status?: string | null } | null
  package?: { type?: 'no_adult' | 'full_adult'; adultContent?: boolean } | null
  apps: CatalogAppCredential[]
  warnings?: string[]
  error?: string
}

type ClientEditForm = {
  name: string
  phone: string
  status: string
  app: string
  panel: string
  planKey: string
  screensCount: ScreensCount
  packageType: 'no_adult' | 'full_adult'
  amount: string
  dueAt: string
  username: string
  password: string
  host: string
  providerCode: string
  notes: string
}

type AssistantMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  created_at: string
}

type AssistantPayload = {
  memory: {
    resumo_cliente?: string
    problemas_recorrentes?: string[]
    historico_acoes?: Array<{ at?: string; note?: string }>
    chat_messages?: AssistantMessage[]
  }
  context: Record<string, unknown>
  execution?: { available: boolean; reason?: string }
}

function Field({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <Icon className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-200 truncate">{value}</p>
      </div>
    </div>
  )
}

function toInputDate(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return br ? `${br[3]}-${br[2]}-${br[1]}` : ''
}

function amountTextFromCents(value?: number | null, fallback = 0): string {
  const amount = Number(value || fallback || 0) / 100
  return amount > 0 ? amount.toFixed(2).replace('.', ',') : ''
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string): string {
  const value = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata[key] : null
  return typeof value === 'string' ? value : ''
}

export function ClientDrawer({
  cliente,
  onClose,
  onRenovar,
}: {
  cliente: Cliente | null
  onClose: () => void
  onRenovar: (c: Cliente) => void
}) {
  const { addToast } = useToast()
  const [showSenha, setShowSenha] = useState(false)
  const [details, setDetails] = useState<ClientCredentialsPayload | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantData, setAssistantData] = useState<AssistantPayload | null>(null)
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<ClientEditForm | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradingAdult, setUpgradingAdult] = useState(false)

  useEffect(() => {
    let alive = true
    setDetails(null)
    setDetailsError('')
    if (!cliente?.id) return
    setLoadingDetails(true)
    fetch(`/api/clients/${cliente.id}/credentials`, { cache: 'no-store' })
      .then(async (res) => {
        const payload = await res.json().catch(() => null) as ClientCredentialsPayload | null
        if (!res.ok || !payload?.success) throw new Error(payload?.error || `HTTP ${res.status}`)
        if (alive) setDetails(payload)
      })
      .catch((err) => {
        if (alive) setDetailsError(err instanceof Error ? err.message : 'Falha ao carregar credenciais')
      })
      .finally(() => {
        if (alive) setLoadingDetails(false)
      })
    return () => { alive = false }
  }, [cliente?.id])

  useEffect(() => {
    let alive = true
    if (!assistantOpen || !cliente?.id) return
    setAssistantLoading(true)
    fetch(`/api/clients/${cliente.id}/codex-memory`, { cache: 'no-store' })
      .then(async (res) => {
        const payload = await res.json()
        if (!res.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${res.status}`)
        if (alive) setAssistantData({ memory: payload.memory || {}, context: payload.context || {}, execution: payload.execution })
      })
      .catch((err) => addToast('error', err instanceof Error ? err.message : 'Falha ao carregar Codex IA'))
      .finally(() => {
        if (alive) setAssistantLoading(false)
      })
    return () => { alive = false }
  }, [assistantOpen, cliente?.id, addToast])

  function copyValue(label: string, value?: string | null) {
    const text = String(value || '').trim()
    if (!text) {
      addToast('error', `${label} indisponivel`)
      return
    }
    navigator.clipboard.writeText(text)
    addToast('success', `${label} copiado`)
  }

  function buildEditForm(): ClientEditForm {
    const clientMetadata = details?.client?.legacy_metadata || {}
    const planKey = normalizePlanKey(details?.plan?.key || cliente?.plano || metadataString(clientMetadata, 'plan_key'))
    const screensCount = normalizeScreensCount(
      (clientMetadata.screens_count as number | string | undefined) ||
      (cliente?.telas as number | undefined) ||
      (cliente?.plano?.includes('2') ? 2 : 1)
    )
    const fallbackPlan = officialPlan(planKey, screensCount)
    return {
      name: details?.client?.name || cliente?.nome || '',
      phone: details?.client?.phone_e164 || cliente?.telefone || '',
      status: details?.client?.status || cliente?.status || 'active',
      app: details?.selectedApp?.name || cliente?.app || metadataString(clientMetadata, 'app_label'),
      panel: details?.provider?.name || cliente?.servidor || metadataString(clientMetadata, 'panel_label'),
      planKey,
      screensCount,
      packageType: details?.package?.type === 'full_adult' || clientMetadata.package_type === 'full_adult' ? 'full_adult' : 'no_adult',
      amount: amountTextFromCents(details?.plan?.amountCents, fallbackPlan.amountCents),
      dueAt: toInputDate(details?.plan?.dueAt || details?.account?.expiresAt || cliente?.vencimento),
      username: details?.account?.username || cliente?.usuario || '',
      password: details?.account?.password || '',
      host: details?.account?.host || metadataString(clientMetadata, 'host') || metadataString(clientMetadata, 'dns'),
      providerCode: details?.apps.find((app) => app.providerCode)?.providerCode || metadataString(clientMetadata, 'provider_code'),
      notes: metadataString(clientMetadata, 'operational_notes') || metadataString(clientMetadata, 'notes'),
    }
  }

  function openEditModal() {
    setEditForm(buildEditForm())
    setEditOpen(true)
  }

  async function saveEditForm(payload: ClientEditForm) {
    if (!cliente?.id || savingEdit) return
    setSavingEdit(true)
    try {
      const amount = Number(payload.amount.replace(',', '.'))
      const res = await fetch(`/api/clients/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          phone: payload.phone,
          status: payload.status,
          app: payload.app,
          panel: payload.panel,
          plan_key: payload.planKey,
          screens_count: payload.screensCount,
          package_type: payload.packageType,
          adult_content: payload.packageType === 'full_adult',
          amount_cents: Number.isFinite(amount) ? Math.round(amount * 100) : undefined,
          due_at: payload.dueAt,
          username: payload.username,
          password: payload.password,
          host: payload.host,
          provider_code: payload.providerCode,
          notes: payload.notes,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`)
      setEditOpen(false)
      addToast('success', data.warnings?.length ? 'Cliente atualizado com avisos operacionais' : 'Cliente atualizado')
      if (data.warnings?.length) data.warnings.slice(0, 2).forEach((warning: string) => addToast('info', warning))
      const refreshed = await fetch(`/api/clients/${cliente.id}/credentials`, { cache: 'no-store' })
      const refreshedPayload = await refreshed.json().catch(() => null) as ClientCredentialsPayload | null
      if (refreshed.ok && refreshedPayload?.success) setDetails(refreshedPayload)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Falha ao salvar cliente')
    } finally {
      setSavingEdit(false)
    }
  }

  function readyMessage(app?: CatalogAppCredential) {
    const account = details?.account
    const providerLine = app?.providerCode ? `Provider: ${app.providerCode}` : app?.code ? `Codigo: ${app.code}` : app?.dns ? `DNS: ${app.dns}` : null
    return [
      'Dados de acesso:',
      '',
      app ? `App: ${app.app}` : cliente ? `App: ${cliente.app}` : null,
      providerLine,
      account?.username ? `Usuario: ${account.username}` : null,
      account?.password ? `Senha: ${account.password}` : null,
      account?.host ? `Host: ${account.host}` : null,
    ].filter(Boolean).join('\n')
  }

  async function sendAssistantMessage(text?: string) {
    const content = String(text || assistantInput || '').trim()
    if (!cliente?.id || !content || assistantLoading) return
    setAssistantLoading(true)
    setAssistantInput('')
    try {
      const res = await fetch(`/api/clients/${cliente.id}/codex-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${res.status}`)
      setAssistantData((prev) => ({
        memory: { ...(prev?.memory || {}), chat_messages: payload.messages || [] },
        context: payload.context || prev?.context || {},
        execution: payload.execution || prev?.execution,
      }))
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Falha no Codex IA')
    } finally {
      setAssistantLoading(false)
    }
  }

  async function saveAssistantMemory() {
    if (!cliente?.id) return
    const note = assistantInput.trim()
    if (!note) return addToast('error', 'Escreva uma nota para salvar')
    setAssistantLoading(true)
    try {
      const res = await fetch(`/api/clients/${cliente.id}/codex-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${res.status}`)
      setAssistantInput('')
      setAssistantData((prev) => ({ memory: payload.memory || prev?.memory || {}, context: payload.context || prev?.context || {}, execution: prev?.execution }))
      addToast('success', 'Memoria salva')
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Falha ao salvar memoria')
    } finally {
      setAssistantLoading(false)
    }
  }

  async function createAssistantTask(type: 'prompt' | 'problem') {
    if (!cliente?.id) return
    const description = assistantInput.trim() || `Analisar atendimento do cliente ${cliente.nome}`
    setAssistantLoading(true)
    try {
      const res = await fetch(`/api/clients/${cliente.id}/codex-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, description }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${res.status}`)
      if (type === 'prompt' && payload.prompt) {
        await navigator.clipboard.writeText(payload.prompt)
        addToast('success', 'Prompt para Codex copiado')
      } else {
        addToast('success', 'Ocorrencia criada em Problemas')
      }
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Falha ao criar tarefa')
    } finally {
      setAssistantLoading(false)
    }
  }

  const username = details?.account?.username || cliente?.usuario || ''
  const password = details?.account?.password || cliente?.senha || ''
  const appPreview = details?.apps.slice(0, 8) || []
  const canUpgradeFullAdult = Boolean(cliente && cliente.status === 'ativo' && details?.account?.id)

  async function upgradeToFullAdult() {
    if (!cliente?.id || upgradingAdult) return
    setUpgradingAdult(true)
    try {
      const res = await fetch(`/api/clients/${cliente.id}/upgrade-full-adult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`)
      addToast('success', data.dispatch?.dry_run ? 'Acesso +18 atualizado em dry-run' : 'Acesso atualizado para completo +18')
      setUpgradeOpen(false)
      const refreshed = await fetch(`/api/clients/${cliente.id}/credentials`, { cache: 'no-store' })
      const refreshedPayload = await refreshed.json().catch(() => null) as ClientCredentialsPayload | null
      if (refreshed.ok && refreshedPayload?.success) setDetails(refreshedPayload)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Falha ao trocar para completo +18')
    } finally {
      setUpgradingAdult(false)
    }
  }

  return (
    <AnimatePresence>
      {cliente && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: 'rgba(5,7,12,0.6)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative h-full w-full max-w-md overflow-y-auto"
            style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 p-6" style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                    {cliente.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>{cliente.nome}</h2>
                    <div className="mt-1"><StatusBadge status={cliente.status} dot /></div>
                  </div>
                </div>
                <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Valor */}
              <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Plano {cliente.plano}</p>
                <p className="text-3xl font-bold" style={{ color: '#22c55e', fontFamily: 'var(--font-display)' }}>R$ {cliente.valor.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">Vence em {cliente.vencimento}</p>
              </div>

              {/* Dados */}
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-3">Dados do cliente</p>
                <div className="space-y-3">
                  <Field icon={User} label="Nome" value={cliente.nome} />
                  <Field icon={Phone} label="Telefone" value={cliente.telefone} />
                  <Field icon={Package} label="Aplicativo" value={cliente.app} />
                  <Field icon={Server} label="Servidor" value={cliente.servidor} />
                  <Field icon={Calendar} label="Vencimento" value={cliente.vencimento} />
                </div>
              </div>

              {/* Credenciais */}
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-3">Credenciais</p>
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
                  {loadingDetails && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando catalogo operacional...
                    </div>
                  )}
                  {detailsError && <p className="text-xs text-amber-300">{detailsError}</p>}
                  {details?.provider && (
                    <div className="flex items-center justify-between gap-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Painel do provedor</p>
                        <p className="text-sm font-semibold text-white truncate">{details.provider.name}</p>
                      </div>
                      <button onClick={() => window.open(details.provider?.panelUrl, '_blank')} className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-2" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                        <ExternalLink className="h-3 w-3" /> Abrir
                      </button>
                    </div>
                  )}
                  {details?.warnings?.map((warning) => (
                    <div key={warning} className="flex items-center gap-2 rounded-lg p-2 text-xs text-amber-200" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
                      <AlertTriangle className="h-3.5 w-3.5" /> {warning}
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <KeyRound className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-400">Usuario</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-200 font-mono">{username}</span>
                      <button onClick={() => copyValue('Usuario', username)} className="text-slate-500 hover:text-white">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <KeyRound className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-400">Senha</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-200 font-mono">{showSenha ? password : '•'.repeat(password.length || 6)}</span>
                      <button onClick={() => setShowSenha((v) => !v)} className="text-slate-500 hover:text-white">
                        {showSenha ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                      <button onClick={() => copyValue('Senha', password)} className="text-slate-500 hover:text-white">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button onClick={() => copyValue('M3U', details?.account?.m3u)} className="h-8 rounded-lg text-xs text-slate-300" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>Copiar M3U</button>
                    <button onClick={() => copyValue('HLS', details?.account?.hls)} className="h-8 rounded-lg text-xs text-slate-300" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>Copiar HLS</button>
                    <button onClick={() => copyValue('Mensagem', readyMessage(appPreview[0]))} className="h-8 rounded-lg text-xs text-slate-300 col-span-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>Copiar mensagem pronta</button>
                  </div>
                  {appPreview.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Apps compativeis</p>
                      {appPreview.map((app) => (
                        <div key={app.appKey} className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{app.app}</p>
                              <p className="text-[11px] text-slate-500 truncate">{app.providerCode ? `Provider ${app.providerCode}` : app.code ? `Codigo ${app.code}` : app.dns ? `DNS ${app.dns}` : app.downloader ? `Downloader ${app.downloader}` : app.installHint}</p>
                            </div>
                            <button onClick={() => copyValue(app.app, app.credentialText)} className="h-7 px-2 rounded-lg text-xs flex items-center gap-1" style={{ background: 'rgba(20,184,166,0.12)', color: '#2dd4bf', border: '1px solid rgba(20,184,166,0.25)' }}>
                              <Copy className="h-3 w-3" /> App
                            </button>
                          </div>
                          <button onClick={() => copyValue('Mensagem', readyMessage(app))} className="text-[11px] text-slate-400 hover:text-white">Copiar mensagem deste app</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Historico / Problemas (placeholders preparados para dados reais) */}
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-3">Atividade recente</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <History className="h-3.5 w-3.5 text-slate-500" />
                    <p className="text-xs text-slate-400">Cliente ativado em {cliente.criadoEm}</p>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                    <p className="text-xs text-slate-400">Sem problemas em aberto</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Acoes fixas */}
            <div className="sticky bottom-0 p-4 flex gap-2" style={{ background: 'var(--background)', borderTop: '1px solid var(--border)' }}>
              <button onClick={openEditModal} className="h-10 rounded-xl px-3 text-sm font-medium flex items-center justify-center gap-2" style={{ background: 'rgba(148,163,184,0.1)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.2)' }}>
                <Save className="h-4 w-4" /> Editar
              </button>
              {canUpgradeFullAdult && (
                <button onClick={() => setUpgradeOpen(true)} className="h-10 rounded-xl px-3 text-sm font-medium flex items-center justify-center gap-2" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.28)' }}>
                  <Sparkles className="h-4 w-4" /> +18
                </button>
              )}
              <button onClick={() => setAssistantOpen(true)} className="h-10 rounded-xl px-3 text-sm font-medium flex items-center justify-center gap-2" style={{ background: 'rgba(20,184,166,0.12)', color: '#2dd4bf', border: '1px solid rgba(20,184,166,0.25)' }}>
                <Bot className="h-4 w-4" /> Codex IA
              </button>
              <button onClick={() => onRenovar(cliente)} className="flex-1 h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                <RefreshCw className="h-4 w-4" /> Renovar
              </button>
            </div>
            {editOpen && editForm && (
              <ClientEditModal
                form={editForm}
                saving={savingEdit}
                onChange={setEditForm}
                onClose={() => {
                  if (!savingEdit) setEditOpen(false)
                }}
                onSave={saveEditForm}
              />
            )}
            {assistantOpen && (
              <ClientAssistantModal
                cliente={cliente}
                data={assistantData}
                input={assistantInput}
                loading={assistantLoading}
                onInput={setAssistantInput}
                onClose={() => setAssistantOpen(false)}
                onSend={sendAssistantMessage}
                onSaveMemory={saveAssistantMemory}
                onTask={createAssistantTask}
                onCopyContext={() => {
                  navigator.clipboard.writeText(JSON.stringify(assistantData?.context || {}, null, 2))
                  addToast('success', 'Contexto copiado')
                }}
              />
            )}
            {upgradeOpen && cliente && (
              <FullAdultUpgradeModal
                cliente={cliente}
                details={details}
                upgrading={upgradingAdult}
                onClose={() => {
                  if (!upgradingAdult) setUpgradeOpen(false)
                }}
                onConfirm={upgradeToFullAdult}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ClientEditModal({
  form,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  form: ClientEditForm
  saving: boolean
  onChange: (value: ClientEditForm) => void
  onClose: () => void
  onSave: (value: ClientEditForm) => void
}) {
  function update<K extends keyof ClientEditForm>(key: K, value: ClientEditForm[K]) {
    onChange({ ...form, [key]: value })
  }

  function updatePlan(planKey: string, screensCount = form.screensCount) {
    const selected = officialPlan(planKey, screensCount)
    onChange({
      ...form,
      planKey,
      screensCount,
      amount: (selected.amountCents / 100).toFixed(2).replace('.', ','),
    })
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-3" style={{ background: 'rgba(2,6,23,0.78)', backdropFilter: 'blur(10px)' }} onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl" style={{ background: 'var(--background)', border: '1px solid var(--border)' }} onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-4" style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Cliente</p>
            <h3 className="text-lg font-semibold text-white">Editar dados operacionais</h3>
          </div>
          <button disabled={saving} onClick={onClose} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-white disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <EditField label="Nome" value={form.name} disabled={saving} onChange={(value) => update('name', value)} />
          <EditField label="Telefone" value={form.phone} disabled={saving} onChange={(value) => update('phone', value)} />

          <label className="block">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Status</span>
            <select value={form.status} disabled={saving} onChange={(event) => update('status', event.target.value)} className="mt-2 h-11 w-full rounded-xl px-3 text-sm text-white outline-none disabled:opacity-60" style={{ background: 'var(--input)', border: '1px solid var(--border)' }}>
              <option value="active">Ativo</option>
              <option value="pending">Pendente</option>
              <option value="expired">Expirado</option>
              <option value="suspended">Suspenso</option>
              <option value="lead">Lead</option>
            </select>
          </label>
          <EditField label="App principal" value={form.app} disabled={saving} onChange={(value) => update('app', value)} />
          <EditField label="Painel/provedor" value={form.panel} disabled={saving} onChange={(value) => update('panel', value)} />

          <label className="block">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Plano</span>
            <select value={form.planKey} disabled={saving} onChange={(event) => updatePlan(event.target.value)} className="mt-2 h-11 w-full rounded-xl px-3 text-sm text-white outline-none disabled:opacity-60" style={{ background: 'var(--input)', border: '1px solid var(--border)' }}>
              {OFFICIAL_PLANS.map((plan) => (
                <option key={plan.key} value={plan.key}>{plan.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Quantidade de telas</span>
            <select value={String(form.screensCount)} disabled={saving} onChange={(event) => updatePlan(form.planKey, normalizeScreensCount(event.target.value))} className="mt-2 h-11 w-full rounded-xl px-3 text-sm text-white outline-none disabled:opacity-60" style={{ background: 'var(--input)', border: '1px solid var(--border)' }}>
              <option value="1">1 tela</option>
              <option value="2">2 telas</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Pacote</span>
            <select value={form.packageType} disabled={saving} onChange={(event) => update('packageType', event.target.value as ClientEditForm['packageType'])} className="mt-2 h-11 w-full rounded-xl px-3 text-sm text-white outline-none disabled:opacity-60" style={{ background: 'var(--input)', border: '1px solid var(--border)' }}>
              <option value="no_adult">Sem adulto</option>
              <option value="full_adult">Completo +18</option>
            </select>
          </label>

          <EditField label="Valor do plano" value={form.amount} disabled={saving} onChange={(value) => update('amount', value)} />
          <label className="block">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Vencimento</span>
            <input type="date" value={form.dueAt} disabled={saving} onChange={(event) => update('dueAt', event.target.value)} className="mt-2 h-11 w-full rounded-xl px-3 text-sm text-white outline-none disabled:opacity-60" style={{ background: 'var(--input)', border: '1px solid var(--border)' }} />
          </label>

          <EditField label="Usuário" value={form.username} disabled={saving} onChange={(value) => update('username', value)} />
          <EditField label="Senha" type="password" value={form.password} disabled={saving} onChange={(value) => update('password', value)} />
          <EditField label="Host/DNS" value={form.host} disabled={saving} onChange={(value) => update('host', value)} />
          <EditField label="Provider/código" value={form.providerCode} disabled={saving} onChange={(value) => update('providerCode', value)} />

          <label className="block sm:col-span-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Observações internas</span>
            <textarea value={form.notes} disabled={saving} onChange={(event) => update('notes', event.target.value)} className="mt-2 min-h-24 w-full resize-none rounded-xl px-3 py-3 text-sm text-white outline-none disabled:opacity-60" style={{ background: 'var(--input)', border: '1px solid var(--border)' }} />
          </label>
        </div>

        <div className="sticky bottom-0 flex flex-col gap-2 p-4 sm:flex-row" style={{ background: 'var(--background)', borderTop: '1px solid var(--border)' }}>
          <div className="flex-1 text-xs text-slate-500">
            Plano selecionado: {officialPlan(form.planKey, form.screensCount).displayLabel} · {formatCurrencyBRLFromCents(officialPlan(form.planKey, form.screensCount).amountCents)}
          </div>
          <button disabled={saving} onClick={onClose} className="h-10 rounded-xl px-4 text-sm font-medium text-slate-400 disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
            Cancelar
          </button>
          <button disabled={saving || !form.name.trim()} onClick={() => onSave(form)} className="h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#2563eb' }}>
            <span className="inline-flex items-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

function EditField({
  label,
  value,
  type = 'text',
  disabled,
  onChange,
}: {
  label: string
  value: string
  type?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-xl px-3 text-sm text-white outline-none disabled:opacity-60"
        style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
      />
    </label>
  )
}

function FullAdultUpgradeModal({
  cliente,
  details,
  upgrading,
  onClose,
  onConfirm,
}: {
  cliente: Cliente
  details: ClientCredentialsPayload | null
  upgrading: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const appName = details?.selectedApp?.name || cliente.app
  const panelName = details?.provider?.name || cliente.servidor
  const isXcloud = /x\s*cloud|xcloud/i.test(appName)

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3" style={{ background: 'rgba(2,6,23,0.8)', backdropFilter: 'blur(10px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl" style={{ background: 'var(--background)', border: '1px solid var(--border)' }} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-amber-300">Trocar pacote</p>
            <h3 className="text-lg font-semibold text-white">Trocar para completo +18</h3>
          </div>
          <button disabled={upgrading} onClick={onClose} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-white disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm text-slate-300">Isso vai gerar um novo acesso completo +18 para este cliente. Confirmar?</p>
          <div className="grid gap-2 text-sm">
            <InfoRow label="Cliente" value={cliente.nome} />
            <InfoRow label="App atual" value={appName} />
            <InfoRow label="Painel atual" value={panelName} />
            <InfoRow label="Usuario atual" value={details?.account?.username || cliente.usuario || '-'} />
            <InfoRow label="Vencimento atual" value={cliente.vencimento} />
            <InfoRow label="Plano" value={cliente.plano} />
            <InfoRow label="Telas" value={String(cliente.telas || 1)} />
            <InfoRow label="XCloud" value={isXcloud ? 'Sim' : 'Nao'} />
          </div>
          {isXcloud && (
            <div className="rounded-xl p-3 text-xs text-amber-200" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
              O XCloud sera reconfigurado antes do envio da mensagem. Se falhar, a mensagem de sucesso fica bloqueada.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 p-4 sm:flex-row" style={{ borderTop: '1px solid var(--border)' }}>
          <button disabled={upgrading} onClick={onClose} className="h-10 rounded-xl px-4 text-sm font-medium text-slate-400 disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
            Cancelar
          </button>
          <button disabled={upgrading} onClick={onConfirm} className="h-10 flex-1 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#f59e0b' }}>
            <span className="inline-flex items-center justify-center gap-2">
              {upgrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {upgrading ? 'Atualizando...' : 'Confirmar troca'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-right font-semibold text-white">{value}</span>
    </div>
  )
}

function ClientAssistantModal({
  cliente,
  data,
  input,
  loading,
  onInput,
  onClose,
  onSend,
  onSaveMemory,
  onTask,
  onCopyContext,
}: {
  cliente: Cliente
  data: AssistantPayload | null
  input: string
  loading: boolean
  onInput: (value: string) => void
  onClose: () => void
  onSend: (text?: string) => void
  onSaveMemory: () => void
  onTask: (type: 'prompt' | 'problem') => void
  onCopyContext: () => void
}) {
  const messages = data?.memory.chat_messages || []
  const context = data?.context || {}
  const contextCards: Array<[string, string]> = [
    ['App', context.app || cliente.app],
    ['Painel', context.panel || cliente.servidor],
    ['Status', context.status || cliente.status],
    ['Vencimento', context.due_at || cliente.vencimento],
    ['Plano', context.plan || cliente.plano],
    ['Usuario', context.username || cliente.usuario],
    ['Device', context.device_key || ''],
  ].map(([label, value]) => [String(label), String(value || '')] as [string, string]).filter(([, value]) => value.trim())

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3" style={{ background: 'rgba(2,6,23,0.76)', backdropFilter: 'blur(10px)' }} onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl" style={{ background: 'var(--background)', border: '1px solid var(--border)' }} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-300">
              <Sparkles className="h-3.5 w-3.5" /> Assistente do cliente
            </div>
            <h3 className="truncate text-lg font-semibold text-white">{cliente.nome}</h3>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-white" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid max-h-[calc(92vh-74px)] grid-rows-[auto_1fr_auto]">
          <div className="p-4 space-y-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {contextCards.map(([label, value]) => (
                <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--border)' }}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
                  <p className="truncate text-xs font-semibold text-slate-200">{String(value)}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton icon={MessageSquare} label="Gerar diagnostico" onClick={() => onSend('Gerar diagnostico operacional deste cliente.')} />
              <ActionButton icon={ClipboardList} label="Prompt Codex" onClick={() => onTask('prompt')} />
              <ActionButton icon={Save} label="Salvar memoria" onClick={onSaveMemory} />
              <ActionButton icon={Bug} label="Criar ocorrencia" onClick={() => onTask('problem')} />
              <ActionButton icon={Copy} label="Copiar contexto" onClick={onCopyContext} />
            </div>
            {data?.execution && !data.execution.available && (
              <p className="text-[11px] text-slate-500">{data.execution.reason}</p>
            )}
          </div>

          <div className="min-h-[280px] overflow-y-auto p-4 space-y-3">
            {loading && !messages.length && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando memoria...
              </div>
            )}
            {!loading && !messages.length && (
              <div className="rounded-2xl p-5 text-sm text-slate-400" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <Bot className="mb-2 h-5 w-5 text-teal-300" />
                Escreva o problema do cliente ou gere um diagnostico.
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${message.created_at}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed" style={{
                  background: message.role === 'user' ? 'rgba(59,130,246,0.16)' : 'rgba(20,184,166,0.1)',
                  border: message.role === 'user' ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(20,184,166,0.22)',
                  color: '#e2e8f0',
                }}>
                  {message.content}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(event) => onInput(event.target.value)}
                placeholder="Descreva problema, ajuste, historico ou pedido para este cliente..."
                className="min-h-12 flex-1 resize-none rounded-xl px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600"
                style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
              />
              <button disabled={loading || !input.trim()} onClick={() => onSend()} className="h-12 w-12 rounded-xl flex items-center justify-center text-white disabled:opacity-50" style={{ background: '#2563eb' }}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionButton({ icon: Icon, label, onClick }: { icon: typeof Bot; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-9 rounded-xl px-3 text-xs font-semibold flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: '#cbd5e1' }}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )
}
