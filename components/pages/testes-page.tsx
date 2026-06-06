'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TestTube2, Search, Clock, Eye, Zap, ExternalLink,
  AlertTriangle, Trash2, X, Loader2
} from 'lucide-react'
import {
  MOCK_TESTES,
  type Teste,
  type StatusTeste
} from '@/lib/mock-data'
import { useToast } from '@/components/ui/toast'
import { getProviderPanelUrl } from '@/lib/config/provider-catalog'

const JANELA_TESTE_MS = 75 * 60 * 1000

// ——— Countdown hook ———
function useCountdown(validade: string) {
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
      setPct(Math.max(0, Math.min(100, (diff / JANELA_TESTE_MS) * 100)))
      if (h >= 24) setRemaining(`${Math.floor(h / 24)}d ${h % 24}h`)
      else if (h > 0) setRemaining(`${h}h ${m}m`)
      else setRemaining(`${m}min`)
    }
    calc()
    const id = setInterval(calc, 30000)
    return () => clearInterval(id)
  }, [validade])

  return { remaining, urgente, expirado, pct }
}

// ——— Status config ———
const STATUS: Record<StatusTeste, { label: string; color: string }> = {
  ativo:        { label: 'Testando', color: '#22c55e' },
  expirado:     { label: 'Expirado', color: '#ef4444' },
  pago:         { label: 'Convertido', color: '#3b82f6' },
  sem_resposta: { label: 'Aguardando', color: '#f59e0b' },
}

// ——— Card de teste focado em countdown ———
function TesteCard({
  teste, onVerDetalhes, onAtivar, onAbrirPainel2, onExpirar, onRemoverXCloud, isExpiring, highlighted,
}: {
  teste: Teste
  onVerDetalhes: () => void
  onAtivar: () => void
  onAbrirPainel2: () => void
  onExpirar: () => void
  onRemoverXCloud: () => void
  isExpiring?: boolean
  highlighted?: boolean
}) {
  const { remaining, urgente, expirado, pct } = useCountdown(teste.expiresAt || teste.validade)
  const cfg = STATUS[teste.status]
  const isAtivo = teste.status === 'ativo'
  const isExpirado = teste.status === 'expirado' || expirado
  const isXCloud = teste.app.toLowerCase().includes('xcloud')

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-2xl p-5 transition-all relative overflow-hidden"
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
            {isXCloud && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(20,184,166,0.15)', color: '#14b8a6' }}>
                XCloud
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-3">
            {teste.app} · {teste.servidor} · {teste.telefone}
          </p>

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
            {(isAtivo || teste.status === 'sem_resposta') && (
              <button
                onClick={onExpirar}
                disabled={isExpiring}
                className="h-7 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all disabled:cursor-not-allowed disabled:opacity-70"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {isExpiring ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                {isExpiring ? 'Expirando...' : 'Expirar teste'}
              </button>
            )}
            {isExpirado && isXCloud && (
              <button onClick={onRemoverXCloud} className="h-7 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Trash2 className="h-3 w-3" /> Remover device XCloud
              </button>
            )}
            <button onClick={onAbrirPainel2} className="h-7 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
              <ExternalLink className="h-3 w-3" /> Painel 2
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
  const [modalRemoverXCloud, setModalRemoverXCloud] = useState<Teste | null>(null)
  const [expiringTestId, setExpiringTestId] = useState<string | null>(null)
  const [blockedPanelUrl, setBlockedPanelUrl] = useState<string | null>(null)
  const [removendoXCloud, setRemovendoXCloud] = useState(false)
  const [highlightedTestId, setHighlightedTestId] = useState<string | null>(null)
  const { addToast } = useToast()

  const carregarTestes = async () => {
    const res = await fetch('/api/tests', { cache: 'no-store' })
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
        const res = await fetch('/api/tests', { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar testes')
        const payload = await res.json()
        if (!alive) return
        setTestes(Array.isArray(payload.items) ? payload.items : MOCK_TESTES)
        setDataSource(payload.data_source === 'supabase' ? 'supabase' : 'mock')
        if (urlTestId) {
          setSearch(urlTestId)
          setStatusFilter('todos')
          setHighlightedTestId(urlTestId)
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

  const metricas = {
    testesAtivos: testes.filter(t => t.status === 'ativo').length,
    testesExpirados: testes.filter(t => t.status === 'expirado').length,
    testesConvertidos: testes.filter(t => t.status === 'pago').length,
  }

  const testesFiltrados = testes.filter(t => {
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

  const abrirPainel2 = (teste: Teste, flow = 'test_created') => {
    const params = new URLSearchParams({
      source: 'painel1',
      flow,
      test_id: teste.id,
      client_name: teste.cliente,
      client_phone: teste.telefone,
      app: teste.app,
      panel: teste.servidor,
    })
    window.open(`https://painel2.centralplayplus.com.br?${params.toString()}`, '_blank')
  }

  const handleExpirarTeste = async (teste: Teste) => {
    if (expiringTestId) return

    const providerUrl = getProviderPanelUrl(teste.servidor) || getProviderPanelUrl(painelKey(teste.servidor)) || 'https://pedidospec.online/#/customers'
    const openedPanel = window.open('about:blank', '_blank')
    if (openedPanel) {
      openedPanel.opener = null
      openedPanel.location.href = providerUrl
    }
    setBlockedPanelUrl(openedPanel ? null : providerUrl)
    setExpiringTestId(teste.id)
    setModalExpirar(teste)

    try {
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
      if (username) {
        await navigator.clipboard.writeText(username)
      }
      setTestes(prev => prev.map(item => item.id === teste.id ? { ...item, status: 'expirado' as StatusTeste } : item))
      await carregarTestes().catch(() => null)
      setModalExpirar(null)
      const alreadySent = data.already_expired || data.sticker_already_sent || data.dispatch?.already_sent
      const alreadyRunning = data.already_running || data.dispatch?.reason === 'already_running'
      addToast('success', alreadyRunning ? 'Expiracao ja esta em andamento. Aguarde a atualizacao da lista.' : alreadySent ? 'Teste ja estava expirado. Usuario copiado e figurinha nao foi reenviada.' : 'Teste expirado. Usuario copiado e figurinha enviada.')
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Falha ao expirar teste')
    } finally {
      setExpiringTestId(null)
    }
  }

  const handleRemoverXCloud = async (teste: Teste) => {
    setRemovendoXCloud(true)
    try {
      const res = await fetch('/api/xcloud/activate-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_id: teste.id, mode: 'remove_device', confirm_remove: true, operator_ref: 'painel_web' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`)
      abrirPainel2(teste, 'xcloud_remove_device')
      addToast('success', 'Remocao XCloud concluida')
      setModalRemoverXCloud(null)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Falha ao remover device XCloud')
    } finally {
      setRemovendoXCloud(false)
    }
  }

  return (
    <>
    <div className="flex-1 flex flex-col items-center px-6 py-10 min-h-screen">
      {/* Header centralizado */}
      <div className="text-center mb-8 max-w-xl">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Clock className="h-4 w-4" style={{ color: '#60a5fa' }} />
          <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Testes do dia</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Testes do dia
        </h1>
        <p className="text-slate-500 text-sm">
          {metricas.testesAtivos} testando
          {metricas.testesExpirados > 0 && ` · ${metricas.testesExpirados} expirados`}
          {metricas.testesConvertidos > 0 && ` · ${metricas.testesConvertidos} convertidos`}
        </p>
        <p className="text-[10px] text-slate-600 mt-1">Duracao do teste: 1 hora e 15 minutos</p>
        <p className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
           style={{ background: dataSource === 'supabase' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: dataSource === 'supabase' ? '#4ade80' : '#fbbf24' }}>
          Fonte: {dataSource === 'supabase' ? 'Supabase' : 'Mock'}
        </p>
      </div>

      {/* KPIs compactos */}
      <div className="flex items-center gap-8 mb-8">
        {[
          { label: 'Testando', value: metricas.testesAtivos, color: '#22c55e' },
          { label: 'Expirados', value: metricas.testesExpirados, color: '#ef4444' },
          { label: 'Convertidos', value: metricas.testesConvertidos, color: '#3b82f6' },
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
                onVerDetalhes={() => addToast('info', `Detalhes: ${teste.usuario} / ${teste.senha}`)}
                onAtivar={() => window.dispatchEvent(new CustomEvent('centralplay:navigate', { detail: { page: 'ativar-clientes', test_id: teste.id } }))}
                onAbrirPainel2={() => abrirPainel2(teste)}
                onExpirar={() => {
                  if (expiringTestId) return
                  setBlockedPanelUrl(null)
                  setModalExpirar(teste)
                }}
                onRemoverXCloud={() => setModalRemoverXCloud(teste)}
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
          title="Expirar teste"
          description={expiringTestId === modalExpirar.id ? `Expirando teste, copiando usuario e enviando figurinha. Aguarde.` : `Copiar usuario, abrir painel ${modalExpirar.servidor} e mandar contexto test_expired para o Painel 2.`}
          confirmLabel={expiringTestId === modalExpirar.id ? 'Expirando...' : 'Expirar teste'}
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
      {modalRemoverXCloud && (
        <ConfirmModal
          title="Remover device XCloud"
          description="Executa somente localizar, desativar e excluir device. Nao recria, nao gera Yellow, nao vincula Xtream."
          confirmLabel={removendoXCloud ? 'Removendo...' : 'Remover device'}
          danger
          disabled={removendoXCloud}
          onClose={() => setModalRemoverXCloud(null)}
          onConfirm={() => handleRemoverXCloud(modalRemoverXCloud)}
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
