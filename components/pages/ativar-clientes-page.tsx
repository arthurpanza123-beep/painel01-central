'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, ChevronRight, FileText, Search, UserPlus, Users, Zap } from 'lucide-react'

import { useToast } from '@/components/ui/toast'
import { getProviderPanelUrl, listCompatibleApps } from '@/lib/config/provider-catalog'
import type { Cliente } from '@/lib/mock-data'
import { parseProviderText } from '@/lib/services/credentials/parse-provider-text'
import { OFFICIAL_PLANS, officialPlan, normalizeScreensCount, type ScreensCount } from '@/lib/services/official-plans'

type Step = 'busca' | 'app_plano' | 'confirmar'
type PackageType = 'no_adult' | 'full_adult'
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
  app_key: string | null
  panel_key: string | null
  app_name: string | null
  panel_name: string | null
  account_username?: string | null
  account_password?: string | null
  account_expires_at?: string | null
  free_slots_after_activation?: number
  shared_with?: Array<{ client_id: string; name: string | null; slot_number: number }>
}

const APPS = [
  { id: 'xcloud', label: 'XCloud', color: '#14b8a6' },
  { id: 'blessed', label: 'Blessed Player', color: '#ef4444' },
  { id: 'playsim', label: 'PlaySim', color: '#f97316' },
  { id: 'assist_plus', label: 'Assist+', color: '#22c55e' },
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

const PACKAGE_OPTIONS: Array<{ id: PackageType; label: string; color: string }> = [
  { id: 'no_adult', label: 'Sem adulto', color: '#14b8a6' },
  { id: 'full_adult', label: 'Completo +18', color: '#f59e0b' },
]

const PANEL_PROVIDER_LOOKUP: Record<string, string> = {
  yellow: 'Yellow Box',
  yellow_x3: 'Yellow Box X3 / Antigo',
  ninety: 'Ninety',
  cinemax: 'CineMax',
  xbr: 'XBR / DevXTop',
  areaplay: 'AreaPlay / Sigma',
}

type ParsedCredentials = ReturnType<typeof parseProviderText>

const CREDENTIALS_NOT_FOUND_MESSAGE = 'Usuário e senha não foram encontrados no texto colado. Cole novamente os dados completos do painel antes de enviar ao cliente.'
const MASKED_ACCESS_VALUE_RE = /^(?:\*+|x{3,}|X{3,}|-+|_+|•+|●+)$/

function cleanAccessValue(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^[*_`"'\s]+/g, '')
    .replace(/[*_`"',.;\s]+$/g, '')
    .trim()
}

function isInvalidAccessValue(value: unknown): boolean {
  const text = cleanAccessValue(value)
  return !text || /^(?:null|undefined)$/i.test(text) || MASKED_ACCESS_VALUE_RE.test(text)
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value).replace(/\u00a0/g, ' ')
}

function formatDateBR(value: unknown): string {
  const text = String(value || '').trim()
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[1]}/${br[2]}/${br[3]}`
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(date)
}

function appCredentialRequirements(app: string, credentials: Partial<ParsedCredentials> & { provider_code?: string; dns?: string }) {
  const normalized = app.toLowerCase()
  const common = [
    { key: 'username', label: 'Usuário', value: credentials.username },
    { key: 'password', label: 'Senha', value: credentials.password },
  ]
  if (normalized === 'blessed') {
    return [{ key: 'provider', label: 'Provider', value: credentials.providerCode || credentials.provider_code }, ...common]
  }
  if (normalized === 'playsim' || normalized === 'assist_plus') {
    return [{ key: 'code', label: 'Code', value: credentials.code || credentials.provider_code }, ...common]
  }
  if (normalized === 'xcloud') {
    return [{ key: 'host', label: 'Host', value: credentials.host }, ...common]
  }
  if (normalized === 'smart_stb') {
    return [{ key: 'dns', label: 'DNS', value: credentials.smartTvDns || credentials.dns || credentials.host }, ...common]
  }
  return common
}

function validateAccessCredentials(app: string, credentials: Partial<ParsedCredentials> & { provider_code?: string; dns?: string }) {
  const missing = appCredentialRequirements(app, credentials).filter((item) => isInvalidAccessValue(item.value))
  if (!missing.length) return { ok: true as const }
  return { ok: false as const, message: CREDENTIALS_NOT_FOUND_MESSAGE, missing: missing.map((item) => item.label) }
}

export function AtivarClientesPage() {
  const [step, setStep] = useState<Step>('busca')
  const [search, setSearch] = useState('')
  const [serverSearch, setServerSearch] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null)
  const [routeSelectionApplied, setRouteSelectionApplied] = useState(false)
  const [novoCliente, setNovoCliente] = useState({ name: '', phone: '' })
  const [appKey, setAppKey] = useState('xcloud')
  const [panelKey, setPanelKey] = useState('yellow')
  const [packageType, setPackageType] = useState<PackageType>('no_adult')
  const [planKey, setPlanKey] = useState('mensal')
  const [screensCount, setScreensCount] = useState<ScreensCount>(1)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [recommendationAttempted, setRecommendationAttempted] = useState(false)
  const [recommendationError, setRecommendationError] = useState('')
  const [loadingRecommendation, setLoadingRecommendation] = useState(false)
  const [ativando, setAtivando] = useState(false)
  const [providerConfirmed, setProviderConfirmed] = useState(false)
  const [slotConfirmed, setSlotConfirmed] = useState(false)
  const [providerText, setProviderText] = useState('')
  const { addToast } = useToast()

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch('/api/clients?context=activation', { cache: 'no-store' })
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

  useEffect(() => {
    const query = search.trim()
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      if (query.length === 1) return
      try {
        const suffix = query ? `&q=${encodeURIComponent(query)}` : ''
        const res = await fetch(`/api/clients?context=activation${suffix}`, { cache: 'no-store', signal: controller.signal })
        const payload = await res.json()
        setClientes(Array.isArray(payload.items) ? payload.items : [])
        setServerSearch(query)
      } catch {
        if (!controller.signal.aborted) setServerSearch('')
      }
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search])

  const clientesFiltrados = useMemo(() => {
    const s = search.toLowerCase().trim()
    if (!s) return []
    if (serverSearch === search.trim()) return clientes
    return clientes.filter((cliente) =>
      cliente.nome.toLowerCase().includes(s) ||
      cliente.telefone.includes(search) ||
      (cliente.telefoneRaw || '').includes(search.replace(/\D/g, '')) ||
      cliente.usuario.toLowerCase().includes(s)
    )
  }, [clientes, search])

  const plano = officialPlan(planKey, screensCount)
  const valorFinal = plano.amountCents / 100
  const activationTestId = selectedTestId || clienteSelecionado?.activeTestId || null
  const selectedClientName = clienteSelecionado?.nome || novoCliente.name || search
  const selectedClientPhone = clienteSelecionado?.telefoneRaw || clienteSelecionado?.telefone || novoCliente.phone
  const providerLookup = PANEL_PROVIDER_LOOKUP[panelKey] || panelKey
  const providerPanelUrl = getProviderPanelUrl(providerLookup)
  const compatibleApps = listCompatibleApps(providerLookup).slice(0, 8)
  const parsedCredentials = useMemo(() => providerText.trim() ? parseProviderText(providerText) : null, [providerText])
  const hasPastedProviderText = Boolean(providerText.trim())
  const finalActionDisabled =
    ativando ||
    loadingRecommendation ||
    Boolean(!hasPastedProviderText && recommendation?.requires_new_account && packageType !== 'full_adult') ||
    !providerConfirmed
  const finalActionHint = loadingRecommendation
    ? 'Buscando recomendacao de tela...'
    : !hasPastedProviderText && recommendation?.requires_new_account && packageType !== 'full_adult'
      ? 'Sem tela livre compativel para este pacote. Escolha completo +18 ou outro painel.'
      : !providerConfirmed
        ? 'Confirme que ja liberou/renovou no provedor.'
        : !hasPastedProviderText && recommendation?.recommended && !slotConfirmed
          ? 'A tela livre recomendada sera usada ao confirmar.'
          : !hasPastedProviderText && clienteSelecionado?.id && !recommendation
            ? 'A recomendacao sera buscada automaticamente ao confirmar.'
            : recommendationError
              ? 'A tentativa anterior falhou. Ao confirmar, o sistema tenta buscar a recomendacao novamente.'
              : ''

  async function carregarRecomendacao(
    nextApp = appKey,
    nextPanel = panelKey,
    options: { resetProviderConfirmation?: boolean } = {},
  ): Promise<Recommendation | null> {
    setRecommendation(null)
    setRecommendationError('')
    if (options.resetProviderConfirmation !== false) setProviderConfirmed(false)
    setSlotConfirmed(false)
    setRecommendationAttempted(true)
    if (!clienteSelecionado?.id) return null
    setLoadingRecommendation(true)
    try {
      const params = new URLSearchParams({
        app_key: nextApp,
        panel_key: nextPanel,
        screens_count: String(screensCount),
        package_type: packageType,
        adult_content: String(packageType === 'full_adult'),
        ...(clienteSelecionado?.id ? { client_id: clienteSelecionado.id } : {}),
        ...(activationTestId ? { test_id: activationTestId } : {}),
        ...(!clienteSelecionado?.id ? { client: novoCliente.name } : {}),
      })
      const res = await fetch(`/api/activations/recommendation?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`)
      setRecommendation(data)
      return data as Recommendation
    } catch (err) {
      setRecommendation(null)
      const message = err instanceof Error ? err.message : 'Falha ao buscar recomendacao'
      setRecommendationError(message)
      addToast('error', message)
      return null
    } finally {
      setLoadingRecommendation(false)
    }
  }

  function selecionarCliente(cliente: Cliente, testId: string | null = cliente.activeTestId || null) {
    setClienteSelecionado(cliente)
    setSelectedTestId(testId)
    setNovoCliente({ name: '', phone: '' })
    setAppKey(appIdFromName(cliente.app) || 'xcloud')
    setPanelKey(panelIdFromName(cliente.servidor) || 'yellow')
    setPlanKey(planIdFromName(cliente.plano) || 'mensal')
    setScreensCount(normalizeScreensCount(cliente.telas))
    setPackageType('no_adult')
    setRecommendation(null)
    setRecommendationAttempted(false)
    setRecommendationError('')
    setProviderConfirmed(false)
    setSlotConfirmed(false)
    setProviderText('')
    setStep('app_plano')
  }

  useEffect(() => {
    if (routeSelectionApplied || clientes.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const routeTestId = params.get('test_id')
    const routeClientId = params.get('client_id')
    if (!routeTestId && !routeClientId) return

    let alive = true
    async function applyRouteSelection() {
      let found = clientes.find((cliente) =>
        (routeClientId && cliente.id === routeClientId) ||
        (routeTestId && cliente.activeTestId === routeTestId)
      )

      if (!found && routeTestId) {
        try {
          const res = await fetch(`/api/tests?test_id=${encodeURIComponent(routeTestId)}`, { cache: 'no-store' })
          const payload = await res.json().catch(() => null)
          const test = Array.isArray(payload?.items) ? payload.items.find((item: { id?: string }) => item.id === routeTestId) : null
          const clientId = typeof test?.clientId === 'string' ? test.clientId : ''
          if (clientId) found = clientes.find((cliente) => cliente.id === clientId)
        } catch {
          // Mantem a busca manual caso o link profundo nao resolva.
        }
      }

      if (!alive) return
      if (found) {
        setSearch(found.nome)
        selecionarCliente(found, routeTestId || found.activeTestId || null)
      }
      setRouteSelectionApplied(true)
    }

    void applyRouteSelection()
    return () => { alive = false }
  }, [clientes, routeSelectionApplied])

  function criarNovo() {
    setClienteSelecionado(null)
    setSelectedTestId(null)
    setNovoCliente({ name: search, phone: '' })
    setRecommendation(null)
    setRecommendationAttempted(false)
    setRecommendationError('')
    setProviderConfirmed(false)
    setSlotConfirmed(false)
    setProviderText('')
    setPackageType('no_adult')
    setStep('app_plano')
  }

  function atualizarTextoPainel(value: string) {
    setProviderText(value)
    const parsed = parseProviderText(value)
    if (parsed.planKey) setPlanKey(parsed.planKey)
    if (parsed.screensCount) setScreensCount(parsed.screensCount)
    if (parsed.packageType === 'full_adult' || parsed.packageType === 'no_adult') setPackageType(parsed.packageType)
    setRecommendation(null)
    setRecommendationAttempted(false)
    setSlotConfirmed(false)
  }

  async function confirmar() {
    if (!selectedClientName || !selectedClientPhone) {
      addToast('error', 'Informe nome e telefone do cliente')
      return
    }
    if (hasPastedProviderText) {
      setStep('confirmar')
      return
    }
    const loaded = recommendation || await carregarRecomendacao()
    if (!loaded && clienteSelecionado?.id) {
      setStep('confirmar')
      return
    }
    setStep('confirmar')
  }

  async function ativarCliente() {
    let activeRecommendation = hasPastedProviderText ? null : recommendation
    if (!hasPastedProviderText && clienteSelecionado?.id && !activeRecommendation) {
      activeRecommendation = await carregarRecomendacao(appKey, panelKey, { resetProviderConfirmation: false })
      if (!activeRecommendation) {
        addToast('error', 'Nao foi possivel buscar a recomendacao de tela. Tente novamente.')
        return
      }
    }
    if (activeRecommendation?.requires_new_account) {
      if (packageType !== 'full_adult') {
        addToast('error', 'Nenhuma tela livre encontrada para este painel/app. Crie uma nova conta ou escolha outro painel.')
        return
      }
    }
    if (activeRecommendation?.recommended && !slotConfirmed) {
      addToast('error', 'Confirme visualmente a conta e a tela antes de concluir.')
      return
    }
    if (!providerConfirmed) {
      addToast('error', 'Confirme que voce ja liberou/renovou no painel do provedor')
      return
    }
    if (providerText.trim()) {
      const parsedValidation = validateAccessCredentials(appKey, parsedCredentials || {})
      if (!parsedValidation.ok) {
        addToast('error', parsedValidation.message)
        return
      }
    }
    setAtivando(true)
    try {
      const res = await fetch('/api/activations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(clienteSelecionado?.id ? { client_id: clienteSelecionado.id } : { client: { name: selectedClientName, phone: selectedClientPhone } }),
          ...(activationTestId ? { test_id: activationTestId } : {}),
          app_id: activeRecommendation?.app_id || undefined,
          panel_id: activeRecommendation?.panel_id || undefined,
          app_key: activeRecommendation?.app_key || appKey,
          panel_key: activeRecommendation?.panel_key || panelKey,
          plan_key: planKey,
          screens_count: screensCount,
          package_type: packageType,
          adult_content: packageType === 'full_adult',
          amount: valorFinal,
          account_id: hasPastedProviderText ? undefined : activeRecommendation?.account_id || undefined,
          slot_id: hasPastedProviderText ? undefined : activeRecommendation?.slot_id || undefined,
          slot_number: hasPastedProviderText ? undefined : activeRecommendation?.slot_number || undefined,
          create_new_account_confirmed: hasPastedProviderText ? true : undefined,
          new_account: parsedCredentials ? {
            username: parsedCredentials.username,
            password_secret: parsedCredentials.password,
            provider_code: parsedCredentials.providerCode || parsedCredentials.code,
            panel_external_id: parsedCredentials.providerCode || parsedCredentials.code,
            expires_at: parsedCredentials.dueAt,
          } : undefined,
          due_at: parsedCredentials?.dueAt || undefined,
          credentials: parsedCredentials ? {
            username: parsedCredentials.username,
            password: parsedCredentials.password,
            host: parsedCredentials.host,
            smart_tv_dns: parsedCredentials.smartTvDns,
            dns: parsedCredentials.smartTvDns,
            web_player: parsedCredentials.webPlayer,
            checkout_url: parsedCredentials.checkoutUrl,
            due_at: parsedCredentials.dueAt,
            provider_code: parsedCredentials.providerCode,
            code: parsedCredentials.code,
            panel_name: parsedCredentials.panelName,
            app_name: parsedCredentials.appName,
            raw_text: parsedCredentials.rawText,
            package_type: parsedCredentials.packageType,
          } : undefined,
          operator_ref: 'painel_web',
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`)
      addToast('success', 'Cliente ativado com sucesso')
      const dispatchCredentials = {
        username: parsedCredentials?.username || data.activation?.credentials?.username || '',
        password: parsedCredentials?.password || data.activation?.credentials?.password || '',
        host: parsedCredentials?.host || data.activation?.credentials?.host || '',
        smartTvDns: parsedCredentials?.smartTvDns || data.activation?.credentials?.smart_tv_dns || '',
        dns: parsedCredentials?.smartTvDns || data.activation?.credentials?.dns || data.activation?.credentials?.smart_tv_dns || '',
        providerCode: parsedCredentials?.providerCode || data.activation?.credentials?.provider_code || '',
        provider_code: parsedCredentials?.providerCode || data.activation?.credentials?.provider_code || '',
        code: parsedCredentials?.code || data.activation?.credentials?.code || data.activation?.credentials?.provider_code || '',
      }
      const dispatchValidation = validateAccessCredentials(appKey, dispatchCredentials)
      if (!dispatchValidation.ok) throw new Error(dispatchValidation.message)
      const displayDueAt = formatDateBR(data.activation?.due_at || parsedCredentials?.dueAt || '')
      const flowRes = await fetch('/api/flows/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow: 'access_activated',
          phone: selectedClientPhone,
          client: { name: selectedClientName, phone: selectedClientPhone },
          activation: {
            app: APPS.find((item) => item.id === appKey)?.label || appKey,
            panel: activeRecommendation?.panel_name || PAINEIS.find((item) => item.id === panelKey)?.label || panelKey,
            plan: plano.displayLabel,
            amount: formatCurrencyBRL(valorFinal),
            dueAt: displayDueAt,
            vencimento: displayDueAt,
            username: dispatchCredentials.username,
            password: dispatchCredentials.password,
            host: dispatchCredentials.host,
            dns: dispatchCredentials.dns,
            provider_code: dispatchCredentials.provider_code,
            providerCode: dispatchCredentials.providerCode,
            code: dispatchCredentials.code,
            package_type: packageType,
          },
          context: {
            source: 'painel1',
            client_id: data.activation?.client_id || clienteSelecionado?.id || '',
            test_id: data.activation?.test_id || activationTestId || '',
            operator_ref: 'painel_web',
            package_type: packageType,
          },
        }),
      })
      const flowData = await flowRes.json().catch(() => null)
      if (!flowRes.ok || flowData?.ok === false) addToast('error', flowData?.message || 'Ativado, mas flow do Painel 2 falhou')
      else addToast('success', flowData?.dryRun ? 'Mensagem de ativacao preparada em dry-run' : 'Mensagem de ativacao enviada')
      setStep('busca')
      setSearch('')
      setClienteSelecionado(null)
      setSelectedTestId(null)
      setNovoCliente({ name: '', phone: '' })
      setRecommendation(null)
      setProviderText('')
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
        <p className="text-slate-500 text-sm">Ative clientes pagos usando telas reais disponiveis</p>
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
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">{cliente.nome}</p>
                        {cliente.activeTestId && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.22)' }}>
                            teste ativo
                          </span>
                        )}
                        {cliente.rawStatus === 'lead' && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.22)' }}>
                            lead
                          </span>
                        )}
                      </div>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{clienteSelecionado.nome}</p>
                      {activationTestId && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.22)' }}>
                          teste ativo vinculado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{clienteSelecionado.telefone}</p>
                    {activationTestId && (
                      <p className="mt-2 text-xs text-amber-300">A ativacao vai converter este teste para pago sem ocupar tela antes da confirmacao.</p>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={novoCliente.name} onChange={(event) => setNovoCliente(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome" className="h-10 rounded-lg px-3 text-sm text-white outline-none" style={{ background: 'var(--input)', border: '1px solid var(--border)' }} />
                    <input value={novoCliente.phone} onChange={(event) => setNovoCliente(prev => ({ ...prev, phone: event.target.value }))} placeholder="Telefone" className="h-10 rounded-lg px-3 text-sm text-white outline-none" style={{ background: 'var(--input)', border: '1px solid var(--border)' }} />
                  </div>
                )}
              </Panel>
              <Picker title="Aplicativo" items={APPS} value={appKey} onChange={(value) => { setAppKey(value); setProviderConfirmed(false); setSlotConfirmed(false); carregarRecomendacao(value, panelKey) }} />
              <Picker title="Painel gerador" items={PAINEIS.map(p => ({ ...p, color: '#60a5fa' }))} value={panelKey} onChange={(value) => { setPanelKey(value); setProviderConfirmed(false); setSlotConfirmed(false); carregarRecomendacao(appKey, value) }} />
              <Picker
                title="Pacote"
                items={PACKAGE_OPTIONS}
                value={packageType}
                onChange={(value) => {
                  setPackageType(value as PackageType)
                  setRecommendation(null)
                  setRecommendationAttempted(false)
                  setSlotConfirmed(false)
                  setProviderConfirmed(false)
                }}
              />
              <Panel title="Colar dados do painel">
                <div className="space-y-3">
                  <textarea
                    value={providerText}
                    onChange={(event) => atualizarTextoPainel(event.target.value)}
                    placeholder="Cole aqui o texto completo do painel/provedor..."
                    className="min-h-36 w-full resize-y rounded-xl px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600"
                    style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
                  />
                  {parsedCredentials && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
                        <FileText className="h-4 w-4" />
                        Dados extraidos
                      </div>
                      <div className="grid gap-2 text-xs sm:grid-cols-2">
                        <Extracted label="Usuario" value={parsedCredentials.username} />
                        <Extracted label="Senha" value={parsedCredentials.password} />
                        <Extracted label="Host/DNS" value={parsedCredentials.host} />
                        <Extracted label="DNS Smart" value={parsedCredentials.smartTvDns} />
                        <Extracted label="Web Player" value={parsedCredentials.webPlayer} />
                        <Extracted label="Checkout" value={parsedCredentials.checkoutUrl} />
                        <Extracted label="Vencimento" value={parsedCredentials.dueAtText} />
                        <Extracted label="Provider" value={parsedCredentials.providerCode} />
                        <Extracted label="Code" value={parsedCredentials.code} />
                        <Extracted label="Code RP725" value={parsedCredentials.rp725Code} />
                        <Extracted label="Painel provavel" value={parsedCredentials.panelName} />
                        <Extracted label="App provavel" value={parsedCredentials.appName} />
                        <Extracted label="Plano" value={parsedCredentials.planKey} />
                        <Extracted label="Telas" value={parsedCredentials.screensCount ? String(parsedCredentials.screensCount) : ''} />
                      </div>
                      {parsedCredentials.warnings.length > 0 && (
                        <p className="mt-2 text-[11px] text-amber-300">{parsedCredentials.warnings.join(' ')}</p>
                      )}
                    </div>
                  )}
                </div>
              </Panel>
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
              <Picker
                title="Telas"
                items={[
                  { id: '1', label: '1 tela', color: '#14b8a6' },
                  { id: '2', label: '2 telas', color: '#22c55e' },
                ]}
                value={String(screensCount)}
                onChange={(value) => {
                  setScreensCount(normalizeScreensCount(value))
                  setRecommendation(null)
                  setRecommendationAttempted(false)
                  setSlotConfirmed(false)
                }}
              />
              <Picker title="Plano" items={OFFICIAL_PLANS.map(p => {
                const selected = officialPlan(p.key, screensCount)
                return { id: p.key, label: `${selected.displayLabel} · R$ ${(selected.amountCents / 100).toFixed(0)}`, color: '#22c55e' }
              })} value={planKey} onChange={(value) => { setPlanKey(value); setRecommendation(null); setSlotConfirmed(false) }} />
              <button onClick={confirmar} className="w-full h-12 rounded-xl text-sm font-semibold text-white" style={{ background: '#2563eb' }}>Continuar</button>
            </motion.div>
          )}

          {step === 'confirmar' && (
            <motion.div key="confirmar" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
              <Panel title="Confirmacao">
                <div className="space-y-2 text-sm">
                  <Row label="Cliente" value={selectedClientName} />
                  <Row label="Telefone" value={selectedClientPhone} />
                  <Row label="App" value={APPS.find(item => item.id === appKey)?.label || appKey} />
                  <Row label="Painel" value={PAINEIS.find(item => item.id === panelKey)?.label || panelKey} />
                  <Row label="Pacote" value={PACKAGE_OPTIONS.find((item) => item.id === packageType)?.label || 'Sem adulto'} />
                  <Row label="Plano" value={plano.displayLabel} />
                  <Row label="Telas" value={`${screensCount}`} />
                  <Row label="Valor" value={formatCurrencyBRL(valorFinal)} />
                </div>
              </Panel>
              <Panel title="Catalogo aplicado">
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Apps compativeis serao montados pelo catalogo do provedor, sem codigo generico.</p>
                  {providerPanelUrl && <Row label="Painel do provedor" value={providerPanelUrl} />}
                </div>
              </Panel>
              {!hasPastedProviderText && <Panel title="Recomendacao de tela">
                {loadingRecommendation ? <p className="text-sm text-slate-500">Buscando tela livre...</p> : recommendationError ? (
                  <p className="text-sm text-red-300">{recommendationError}</p>
                ) : recommendation ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold" style={{ color: recommendation.recommended ? '#4ade80' : '#fbbf24' }}>
                      {recommendation.recommended ? 'Tela livre encontrada' : packageType === 'full_adult' ? 'Sem tela +18 livre; gerar novo acesso' : 'Sem tela livre compativel'}
                    </p>
                    <p className="text-xs text-slate-500">{recommendation.reason}</p>
                    {packageType === 'full_adult' && recommendation.requires_new_account && (
                      <p className="text-xs text-amber-300">Ao confirmar, o sistema vai gerar um novo acesso completo +18 pela API configurada.</p>
                    )}
                    {screensCount === 2 && recommendation.recommended && (
                      <p className="text-xs text-emerald-300">A recomendacao foi filtrada para duas telas livres na mesma conta.</p>
                    )}
                    {recommendation.recommended && (
                      <div className="space-y-3">
                        <p className="text-xs text-emerald-300">Existe tela livre nesta conta. Usar essa tela economiza crédito.</p>
                        <p className="text-xs text-slate-500">{recommendation.account_label}: {recommendation.slot_label}</p>
                        <div className="grid gap-2 text-xs sm:grid-cols-2">
                          <Row label="Conta usada" value={recommendation.account_label || '-'} />
                          <Row label="Usuario da conta" value={recommendation.account_username || '-'} />
                          <Row label="Senha da conta" value={recommendation.account_password || '-'} />
                          <Row label="Tela/slot ocupado" value={recommendation.slot_label || '-'} />
                          <Row label="Telas livres apos ativar" value={String(recommendation.free_slots_after_activation ?? '-')} />
                          <Row label="Vencimento da conta" value={formatDateBR(recommendation.account_expires_at || '') || '-'} />
                          <Row label="Vencimento do cliente" value={formatDateBR(parsedCredentials?.dueAt || '') || 'Calculado pelo plano'} />
                          <Row label="Valor/plano" value={`${plano.displayLabel} · ${formatCurrencyBRL(valorFinal)}`} />
                        </div>
                        {recommendation.shared_with?.length ? (
                          <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                            <p className="mb-1 text-[11px] text-slate-500 uppercase tracking-wider">Vai dividir com</p>
                            {recommendation.shared_with.map((item) => (
                              <p key={`${item.client_id}:${item.slot_number}`} className="text-xs text-slate-300">Tela {item.slot_number}: {item.name || item.client_id}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">Conta sem outro cliente ocupando tela no momento.</p>
                        )}
                        <button
                          onClick={() => setSlotConfirmed((value) => !value)}
                          className="h-10 w-full rounded-xl text-xs font-semibold"
                          style={{
                            background: slotConfirmed ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.1)',
                            border: slotConfirmed ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(245,158,11,0.24)',
                            color: slotConfirmed ? '#4ade80' : '#fbbf24',
                          }}
                        >
                          {slotConfirmed ? 'Tela livre confirmada' : 'Confirmar uso desta tela livre'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : recommendationAttempted ? (
                  <p className="text-sm text-slate-500">Nenhuma tela livre encontrada para este painel/app. Crie uma nova conta ou escolha outro painel.</p>
                ) : (
                  <p className="text-sm text-slate-500">A recomendacao sera buscada antes da ativacao.</p>
                )}
              </Panel>}
              {parsedCredentials && (
                <Panel title="Credenciais extraidas">
                  <div className="grid gap-2 text-sm">
                    <Row label="Usuario" value={parsedCredentials.username || '-'} />
                    <Row label="Senha" value={parsedCredentials.password || '-'} />
                    <Row label="Host/DNS" value={parsedCredentials.host || '-'} />
                    <Row label="Provider/Code" value={parsedCredentials.providerCode || parsedCredentials.code || '-'} />
                    <Row label="Vencimento colado" value={parsedCredentials.dueAtText || '-'} />
                  </div>
                </Panel>
              )}
              <Panel title="Confirmacao no provedor">
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">{packageType === 'full_adult' ? 'Confirme que a geracao completo +18 pode consumir credito se nao houver tela compativel livre.' : 'Abra o painel correto, libere/renove o acesso no provedor e só depois confirme aqui para enviar a mensagem final.'}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {providerPanelUrl && (
                      <button onClick={() => window.open(providerPanelUrl, '_blank')} className="h-10 rounded-xl text-xs font-semibold" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}>
                        Abrir painel do provedor
                      </button>
                    )}
                    <button
                      onClick={() => setProviderConfirmed((value) => !value)}
                      className="h-10 rounded-xl text-xs font-semibold"
                      style={{
                        background: providerConfirmed ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)',
                        border: providerConfirmed ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                        color: providerConfirmed ? '#4ade80' : '#cbd5e1',
                      }}
                    >
                      {providerConfirmed ? 'Confirmado' : packageType === 'full_adult' ? 'Confirmo gerar completo +18' : 'Ja liberei/renovei no painel'}
                    </button>
                  </div>
                </div>
              </Panel>
              <div className="grid gap-2 sm:grid-cols-2">
                <button disabled={finalActionDisabled} onClick={ativarCliente} className="h-12 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#22c55e' }}>
                  {ativando ? 'Ativando...' : 'Confirmar e enviar mensagem final'}
                </button>
                <button onClick={() => setStep('app_plano')} className="h-12 rounded-xl text-sm font-medium text-slate-400" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>Voltar</button>
              </div>
              {finalActionHint && (
                <p className="text-xs text-slate-500">{finalActionHint}</p>
              )}
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
  return OFFICIAL_PLANS.find((plan) => normalized.includes(plan.key) || normalized.includes(plan.label.toLowerCase()))?.key
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

function Extracted({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg px-2 py-1" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 truncate font-semibold text-white">{value || '-'}</span>
    </div>
  )
}
