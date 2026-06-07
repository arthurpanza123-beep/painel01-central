'use client'

import { useState, useEffect } from 'react'
import { m as motion, AnimatePresence } from 'framer-motion'
import {
  TestTube2, Search, Clock, Eye, Zap, ExternalLink,
  Copy, X, Loader2
} from 'lucide-react'
import {
  MOCK_TESTES,
  type Teste,
  type StatusTeste
} from '@/lib/mock-data'
import { useToast } from '@/components/ui/toast'
import { getProviderPanelUrl } from '@/lib/config/provider-catalog'

// ——— Countdown hook ———
function useCountdown(validade: string, durationMinutes?: number) {
  const [remaining, setRemaining] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [expirado, setExpirado] = useState(false)
  const [pct, setPct] = useState(100)

  useEffect(() => {
    const calc = () => {
      const direct = new Date(validade)
      const target = Number.isNaN(direct.getTime()) ? (() => {
        const parts = validade.split(' ')
        const dateParts = parts[0].split('/')
        const timeParts = parts[1] ? parts[1].split(':') : ['23', '59']
        return new Date(
          Number(dateParts[2]),
          Number(dateParts[1]) - 1,
          Number(dateParts[0]),
          Number(timeParts[0]),
          Number(timeParts[1])
        )
      })() : direct
      const diff = target.getTime() - Date.now()
      if (diff <= 0) {
        setRemaining('Expirado')
        setUrgente(true)
        setExpirado(true)
        setPct(0)
        return
      }
      setExpirado(false)
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setUrgente(h < 1)
      const totalMs = Math.max(1, Number(durationMinutes || 75)) * 60 * 1000
      setPct(Math.max(0, Math.min(100, (diff / totalMs) * 100)))
      if (h >= 24) setRemaining(`${Math.floor(h / 24)}d ${h % 24}h`)
      else if (h > 0) setRemaining(`${h}h ${m}m`)
      else setRemaining(`${m}min`)
    }
    calc()
    const id = setInterval(calc, 30000)
    return () => clearInterval(id)
  }, [validade, durationMinutes])

  return { remaining, urgente, expirado, pct }
}

// ——— Status config ———
const STATUS: Record<StatusTeste, { label: string; color: string }> = {
  ativo:        { label: 'Testando', color: '#22c55e' },
  expirado:     { label: 'Expirado', color: '#ef4444' },
  pago:         { label: 'Convertido', color: '#3b82f6' },
  sem_resposta: { label: 'Aguardando', color: '#f59e0b' },
}

// Janela em que um teste expirado continua visível antes de sumir da lista
const JANELA_EXPIRADO_MS = 10 * 60 * 1000

function parseValidade(raw: string): number {
  const direct = new Date(raw)
  if (!Number.isNaN(direct.getTime())) return direct.getTime()
  const parts = raw.split(' ')
  const d = parts[0].split('/')
  const t = parts[1] ? parts[1].split(':') : ['23', '59']
  return new Date(Number(d[2]), Number(d[1]) - 1, Number(d[0]), Number(t[0]), Number(t[1])).getTime()
}

// Só permanecem visíveis: quem está em teste (countdown rodando) ou expirou nos últimos 10 min
function testeVisivel(teste: Teste, now: number): boolean {
  if (teste.status === 'pago') return false // convertido -> virou cliente, sai da lista
  const exp = parseValidade(teste.expiresAt || teste.validade)
  if (Number.isNaN(exp)) return teste.status === 'ativo' || teste.status === 'sem_resposta'
  if (exp > now) return true // ainda em teste
  return now - exp <= JANELA_EXPIRADO_MS // expirou nos últimos 10 min
}

// ——— Card de teste focado em countdown ———
function TesteCard({
  teste, onVerDetalhes, onAtivar, onAbrirPainel, onExpirar, onCopiarUsuario, isExpiring, highlighted,
}: {
  teste: Teste
  onVerDetalhes: () => void
  onAtivar: () => void
  onAbrirPainel: () => void
  onExpirar: () => void
  onCopiarUsuario: () => void
  isExpiring?: boolean
  highlighted?: boolean
}) {
  const { remaining, urgente, expirado, pct } = useCountdown(teste.expiresAt || teste.validade, teste.durationMinutes)
  const cfg = STATUS[teste.status]
  const canExpire = Boolean(teste.canExpire ?? (teste.status === 'ativo' || teste.status === 'sem_resposta'))
  const isAtivo = teste.status === 'ativo' || canExpire
  const isExpirado = teste.status === 'expirado' || expirado
  const isFinalizado = isExpirado && !canExpire
  const isXCloud = teste.app.toLowerCase().includes('xcloud')

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-2xl p-5 transition-all relative overflow-hidden"
      data-test-id={teste.id}
      style={{
        background: 'var(--card)',
        border: highlighted
          ? '1px solid rgba(96,165,250,0.8)'
          : isAtivo && urgente
          ? '1px solid rgba(239,68,68,0.35)'
          : '1px solid var(--border)',
        boxShadow: highlighted ? '0 0 0 3px rgba(96,165,250,0.16)' : undefined,
      }}
    >
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
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">expira sozinho</p>
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
            {isXCloud && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(20,184,166,0.15)', color: '#14b8a6' }}>
                XCloud
              </span>
            )}
            {isAtivo && teste.durationMinutes && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }}>
                {teste.gameModeDuration ? 'Auto 45 min · horário de jogo' : `Auto ${teste.durationMinutes} min`}
              </span>
            )}
            {isAtivo && isXCloud && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(20,184,166,0.12)', color: '#2dd4bf' }}>
                remoção automática ao expirar
              </span>
            )}
            {isAtivo && !isXCloud && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }}>
                encerrar no painel ao expirar
              </span>
            )}
            {isExpirado && teste.xcloudRemoved && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(20,184,166,0.12)', color: '#2dd4bf' }}>
                XCloud removido
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3">
            {teste.app} · {teste.servidor} · {teste.telefone}
          </p>
          {isFinalizado && (
            <p className="text-[11px] text-slate-500 mb-3 -mt-2">
              {isXCloud
                ? (teste.xcloudRemoved ? 'Figurinha enviada · XCloud removido automaticamente' : 'Encerrado · figurinha enviada')
                : 'Encerrado · figurinha enviada · encerrar usuário no painel'}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onVerDetalhes}
              className="h-7 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all"
              style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}
            >
              <Eye className="h-3 w-3" /> Ver detalhes
            </button>
            {teste.status === 'pago' && (
              <button onClick={onAtivar} className="h-7 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                <Zap className="h-3 w-3" /> Ativar cliente
              </button>
            )}
            {canExpire && (
              <button
                onClick={onExpirar}
                disabled={isExpiring}
                className="h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-70 ml-auto"
                style={{ background: 'transparent', color: '#64748b', border: '1px solid var(--border)' }}
                title="Encerrar agora (o sistema já encerra sozinho ao expirar)"
              >
                {isExpiring ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {isExpiring ? 'Encerrando...' : 'Encerrar agora'}
              </button>
            )}
            {isFinalizado && (
              <button onClick={onAtivar} className="h-7 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                <Zap className="h-3 w-3" /> Renovar / Ativar
              </button>
            )}
            {isFinalizado && (
              <button onClick={onCopiarUsuario} className="h-7 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all" style={{ background: 'rgba(148,163,184,0.1)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.2)' }}>
                <Copy className="h-3 w-3" /> Copiar usuário
              </button>
            )}
            <button onClick={onAbrirPainel} className="h-7 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
              <ExternalLink className="h-3 w-3" /> Abrir painel
            </button>
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
  const [modalExpirar, setModalExpirar] = useState<Teste | null>(null)
  const [expiringTestId, setExpiringTestId] = useState<string | null>(null)
  const [blockedPanelUrl, setBlockedPanelUrl] = useState<string | null>(null)
  const [highlightedTestId, setHighlightedTestId] = useState<string | null>(null)
  const [selectedLinkTestId, setSelectedLinkTestId] = useState<string | null>(null)
  const { addToast } = useToast()

  const testsApiUrl = () => {
    const params = new URLSearchParams(window.location.search)
    const apiParams = new URLSearchParams()
    const testId = params.get('test_id')
    const clientId = params.get('client_id')
    if (testId) apiParams.set('test_id', testId)
    if (clientId) apiParams.set('client_id', clientId)
    const query = apiParams.toString()
    return query ? `/api/tests?${query}` : '/api/tests'
  }

  const carregarTestes = async () => {
    const res = await fetch(testsApiUrl(), { cache: 'no-store' })
    if (!res.ok) throw new Error('Falha ao carregar testes')
    const payload = await res.json()
    setTestes(Array.isArray(payload.items) ? payload.items : MOCK_TESTES)
    setDataSource(payload.data_source === 'supabase' ? 'supabase' : 'mock')
  }

  useEffect(() => {
    let alive = true
    const params = new URLSearchParams(window.location.search)
    const urlTestId = params.get('test_id') || ''
    async function load() {
      try {
        const apiUrl = urlTestId ? `/api/tests?${params.toString()}` : '/api/tests'
        const res = await fetch(apiUrl, { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar testes')
        const payload = await res.json()
        if (!alive) return
	        setTestes(Array.isArray(payload.items) ? payload.items : MOCK_TESTES)
	        setDataSource(payload.data_source === 'supabase' ? 'supabase' : 'mock')
	        if (urlTestId) {
	          setSelectedLinkTestId(urlTestId)
	          setStatusFilter('todos')
          setHighlightedTestId(urlTestId)
          window.setTimeout(() => {
            document.querySelector(`[data-test-id="${CSS.escape(urlTestId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 250)
        }
      } catch {
        if (!alive) return
        setTestes(MOCK_TESTES)
        setDataSource('mock')
      }
    }
    load()
    return () => { alive = false }
  }, [])

  // Relógio que avança para remover testes expirados há mais de 10 min, sem refresh manual
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const testesVisiveis = testes.filter(t => testeVisivel(t, agora))

  const metricas = {
    testesAtivos: testesVisiveis.filter(t => parseValidade(t.expiresAt || t.validade) > agora).length,
    testesExpirados: testesVisiveis.filter(t => parseValidade(t.expiresAt || t.validade) <= agora).length,
  }

  const testesFiltrados = testesVisiveis.filter(t => {
    const matchSearch =
      t.id.toLowerCase().includes(search.toLowerCase()) ||
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

  const painelKey = (servidor: string) => servidor.toLowerCase().replace(/[^a-z0-9]/g, '')

  const providerUrlForTest = (teste: Teste) => (
    getProviderPanelUrl(teste.servidor) || getProviderPanelUrl(painelKey(teste.servidor)) || 'https://pedidospec.online/#/customers'
  )

  const abrirPainelProvedor = (teste: Teste) => {
    window.open(providerUrlForTest(teste), '_blank', 'noopener,noreferrer')
  }

	  const safeCopyUsername = async (username: string | undefined | null) => {
	    const value = String(username || '').trim()
	    if (!value || value.includes('•')) return false
	    try {
	      await navigator.clipboard.writeText(value)
	      return true
	    } catch {
	      return false
	    }
	  }

  const handleExpirarTeste = async (teste: Teste) => {
    if (expiringTestId) return

    const providerUrl = providerUrlForTest(teste)
    const openedPanel = window.open('about:blank', '_blank')
    if (openedPanel) {
      openedPanel.opener = null
      openedPanel.location.href = providerUrl
	    }
	    setBlockedPanelUrl(openedPanel ? null : providerUrl)
	    setExpiringTestId(teste.id)
	    setModalExpirar(null)

    try {
      let copied = await safeCopyUsername(teste.copyUsername)
      if (copied) addToast('success', 'Usuário copiado')
      const res = await fetch('/api/tests/expire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_id: teste.id, confirm_expire: true, operator_ref: 'painel_web' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`)
      if (openedPanel && data.provider_url && openedPanel.location.href !== data.provider_url) {
        openedPanel.location.href = data.provider_url
      }
      if (!openedPanel && data.provider_url) {
        setBlockedPanelUrl(data.provider_url)
      }

      const username = data.username || teste.usuario
      if (!copied && username) {
        copied = await safeCopyUsername(username)
        if (copied) addToast('success', 'Usuário copiado')
      }
	      setTestes(prev => prev.map(item => item.id === teste.id ? { ...item, status: 'expirado' as StatusTeste } : item))
	      await carregarTestes().catch(() => null)
	      setModalExpirar(null)
	      const alreadySent = data.already_sent || data.sticker_already_sent || data.dispatch?.already_sent
	      const alreadyRemoved = data.already_removed || data.xcloud_remove?.already_removed
	      const alreadyRunning = data.already_running || data.dispatch?.reason === 'already_running'
	      if (data.operational_completed === false) {
	        const reason = data.pending_reason === 'xcloud_remove_pending'
	          ? 'Figurinha processada, mas a remocao XCloud ainda esta pendente.'
	          : data.pending_reason === 'customer_sticker_pending'
	          ? 'Nao foi possivel confirmar o envio da figurinha.'
	          : 'Expiracao operacional ainda pendente.'
	        addToast('error', reason)
	      } else {
	        addToast('success', alreadyRunning ? 'Expiracao ja esta em andamento.' : alreadySent || alreadyRemoved ? 'Expiracao operacional ja estava concluida.' : 'Teste expirado e figurinha enviada.')
	      }
	    } catch (err) {
	      setModalExpirar(null)
	      addToast('error', err instanceof Error ? err.message : 'Falha ao expirar teste')
    } finally {
      setExpiringTestId(null)
    }
  }

  const copiarUsuario = async (teste: Teste) => {
    const copied = await safeCopyUsername(teste.copyUsername)
    if (!copied) {
      addToast('error', 'Usuario indisponivel')
      return
    }
    addToast('success', 'Copiado para a area de transferencia')
  }

  return (
    <>
    <div className="flex-1 flex flex-col items-center px-4 py-10 sm:px-6 min-h-screen">
      {/* Header centralizado */}
      <div className="text-center mb-8 max-w-xl">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Clock className="h-4 w-4" style={{ color: '#60a5fa' }} />
          <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Acompanhando testes</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Testes
        </h1>
        <p className="text-slate-500 text-sm">
          {metricas.testesAtivos} testando
          {metricas.testesExpirados > 0 && ` · ${metricas.testesExpirados} saindo da lista`}
	        </p>
	        <p className="text-[11px] text-slate-600 mt-1">Aparece só quem está em teste; ao expirar, o teste fica 10 min na lista e some. Encerram sozinhos: 45 min em horário de jogo ou 1h15 no modo normal.</p>
	        {selectedLinkTestId && (
	          <p className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
	             style={{ background: 'rgba(96,165,250,0.12)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.18)' }}>
	            Teste selecionado pelo link
	          </p>
	        )}
      </div>

      {/* KPIs compactos */}
      <div className="flex items-center gap-4 sm:gap-8 mb-8">
        {[
          { label: 'Testando', value: metricas.testesAtivos, color: '#22c55e' },
          { label: 'Saindo (10 min)', value: metricas.testesExpirados, color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <p className="text-xl font-bold" style={{ color, fontFamily: 'var(--font-display)' }}>{value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

	      {/* Busca + filtros */}
	      <div className="w-full max-w-3xl mb-6">
	        {blockedPanelUrl && (
	          <div className="mb-3 rounded-xl p-3 text-sm text-slate-300" style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(96,165,250,0.24)' }}>
	            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
	              <span>Popup bloqueado. O usuario ja foi copiado quando disponivel.</span>
	              <button
	                onClick={() => window.open(blockedPanelUrl, '_blank', 'noopener,noreferrer')}
	                className="h-10 rounded-lg px-3 text-xs font-semibold text-white"
	                style={{ background: '#2563eb' }}
	              >
	                Abrir painel do provedor
	              </button>
	            </div>
	          </div>
	        )}
	        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative w-full lg:min-w-[260px] lg:flex-1">
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
          <div className="flex gap-1.5 flex-wrap lg:shrink-0">
            {(['todos', 'ativo', 'sem_resposta', 'expirado'] as const).map((s) => (
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
                onVerDetalhes={() => addToast('info', `Detalhes: ${teste.usuario} / ${teste.senha}`)}
                onAtivar={() => { window.dispatchEvent(new CustomEvent('centralplay:navigate', { detail: { page: 'ativar-clientes', test_id: teste.id } })) }}
                onAbrirPainel={() => abrirPainelProvedor(teste)}
	                onExpirar={() => {
	                  if (expiringTestId) return
	                  setBlockedPanelUrl(null)
	                  handleExpirarTeste(teste)
	                }}
                onCopiarUsuario={() => copiarUsuario(teste)}
                isExpiring={expiringTestId === teste.id}
                highlighted={highlightedTestId === teste.id}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
    <AnimatePresence>
      {modalExpirar && (
        <ConfirmModal
          title="Expirar e enviar figurinha"
          description={expiringTestId === modalExpirar.id ? 'Expirando teste, copiando usuario, abrindo painel e enviando figurinha. Aguarde.' : 'Vou copiar o usuário, abrir o painel do provedor, marcar o teste como expirado e enviar a figurinha.'}
          confirmLabel={expiringTestId === modalExpirar.id ? 'Expirando...' : 'Expirar e enviar figurinha'}
          danger
          disabled={expiringTestId === modalExpirar.id}
          blockedPanelUrl={blockedPanelUrl}
          onClose={() => {
            if (expiringTestId === modalExpirar.id) return
            setModalExpirar(null)
          }}
          onConfirm={() => handleExpirarTeste(modalExpirar)}
        />
      )}
    </AnimatePresence>
    </>
  )
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  danger,
  disabled,
  blockedPanelUrl,
  onClose,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  disabled?: boolean
  blockedPanelUrl?: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(7,10,18,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={() => {
        if (!disabled) onClose()
      }}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-md rounded-2xl p-5"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button disabled={disabled} onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-5 text-sm leading-relaxed text-slate-400">{description}</p>
        {blockedPanelUrl && (
          <button
            onClick={() => window.open(blockedPanelUrl, '_blank', 'noopener,noreferrer')}
            className="mb-4 h-11 w-full rounded-xl text-sm font-semibold text-white"
            style={{ background: '#2563eb' }}
          >
            Abrir painel do provedor
          </button>
        )}
        <div className="flex gap-2">
          <button
            disabled={disabled}
            onClick={onConfirm}
            className="h-10 flex-1 rounded-xl text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: danger ? '#ef4444' : '#2563eb' }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {disabled && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </span>
          </button>
          <button disabled={disabled} onClick={onClose} className="h-10 rounded-xl px-4 text-sm font-medium text-slate-400 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
            Cancelar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
