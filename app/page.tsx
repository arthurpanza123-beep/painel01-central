'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { m as motion, AnimatePresence } from 'framer-motion'
import {
  Clock3,
  Headphones,
  Kanban,
  LayoutDashboard,
  Menu,
  RefreshCw,
  TestTube2,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'

const GerarTesteWizard    = dynamic(() => import('@/components/gerar-teste/gerar-teste-wizard').then(m => ({ default: m.GerarTesteWizard })), { ssr: false })
const TestesPage           = dynamic(() => import('@/components/pages/testes-page').then(m => ({ default: m.TestesPage })), { ssr: false })
const AtivarClientesPage   = dynamic(() => import('@/components/pages/ativar-clientes-page').then(m => ({ default: m.AtivarClientesPage })), { ssr: false })
const ClientesPage         = dynamic(() => import('@/components/pages/clientes-page').then(m => ({ default: m.ClientesPage })), { ssr: false })
const ContasPage           = dynamic(() => import('@/components/pages/contas-page').then(m => ({ default: m.ContasPage })), { ssr: false })
const RenovacoesPage       = dynamic(() => import('@/components/pages/renovacoes-page').then(m => ({ default: m.RenovacoesPage })), { ssr: false })
const FinanceiroPage       = dynamic(() => import('@/components/pages/financeiro-page').then(m => ({ default: m.FinanceiroPage })), { ssr: false })
const ProblemasPage        = dynamic(() => import('@/components/pages/problemas-page').then(m => ({ default: m.ProblemasPage })), { ssr: false })
const ConfiguracoesPage    = dynamic(() => import('@/components/pages/configuracoes-page').then(m => ({ default: m.ConfiguracoesPage })), { ssr: false })
const DebugPage            = dynamic(() => import('@/components/pages/debug-page').then(m => ({ default: m.DebugPage })), { ssr: false })
const PipelinePage         = dynamic(() => import('@/components/pages/pipeline-page').then(m => ({ default: m.PipelinePage })), { ssr: false })
const DashboardPage        = dynamic(() => import('@/components/pages/dashboard-page').then(m => ({ default: m.DashboardPage })), { ssr: false })
const Sidebar              = dynamic(() => import('@/components/layout/sidebar').then(m => ({ default: m.Sidebar })), { ssr: false })

export type NavPage = 
  | 'dashboard'
  | 'pipeline'
  | 'gerar-teste' 
  | 'testes' 
  | 'ativar-clientes'
  | 'clientes' 
  | 'contas' 
  | 'renovacoes' 
  | 'financeiro' 
  | 'problemas' 
  | 'configuracoes' 
  | 'debug'

const NAV_ITEMS: { id: NavPage; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'pipeline', label: 'Pipeline', Icon: Kanban },
  { id: 'gerar-teste', label: 'Gerar teste', Icon: Headphones },
  { id: 'testes', label: 'Testes', Icon: TestTube2 },
  { id: 'ativar-clientes', label: 'Ativar clientes', Icon: Zap },
  { id: 'clientes', label: 'Clientes', Icon: Users },
  { id: 'contas', label: 'Contas / Telas', Icon: Wallet },
  { id: 'renovacoes', label: 'Renovações', Icon: RefreshCw },
]

type OperationalSettings = {
  game_mode_enabled: boolean
  test_duration_minutes: number
}

function pageFromSection(section: string | null): NavPage | null {
  if (!section) return null
  if (section === 'tests') return 'testes'
  return NAV_ITEMS.some((item) => item.id === section) ? section as NavPage : null
}

export default function App() {
  const [page, setPage] = useState<NavPage>('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [confirmGameModeOpen, setConfirmGameModeOpen] = useState(false)
  const [settings, setSettings] = useState<OperationalSettings>({ game_mode_enabled: false, test_duration_minutes: 75 })
  const [settingsBusy, setSettingsBusy] = useState(false)
  const { addToast } = useToast()

  const navigate = (nextPage: NavPage) => {
    setPage(nextPage)
    setMobileMenuOpen(false)
    const url = new URL(window.location.href)
    if (nextPage === 'dashboard') url.searchParams.delete('section')
    else url.searchParams.set('section', nextPage)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextPage = pageFromSection(params.get('section'))
    if (nextPage) setPage(nextPage)
  }, [])

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ page?: NavPage }>).detail
      if (detail?.page) navigate(detail.page)
    }
    window.addEventListener('centralplay:navigate', onNavigate)
    return () => window.removeEventListener('centralplay:navigate', onNavigate)
  }, [])

  useEffect(() => {
    let alive = true
    fetch('/api/settings/operational', { cache: 'no-store' })
      .then((res) => res.json())
      .then((payload) => {
        if (alive && payload?.settings) setSettings(payload.settings)
      })
      .catch(() => undefined)
    return () => { alive = false }
  }, [])

  const persistGameMode = async (next: boolean) => {
    if (settingsBusy) return
    setSettingsBusy(true)
    try {
      const res = await fetch('/api/settings/operational', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_mode_enabled: next }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.settings) throw new Error(payload?.message || `HTTP ${res.status}`)
      setSettings(payload.settings)
      window.dispatchEvent(new CustomEvent('centralplay:operational-settings-updated', { detail: payload.settings }))
      addToast('success', next ? 'Horário de Jogo ativado: novos testes terão 45 minutos.' : 'Horário de Jogo desativado: novos testes voltam para 1h15.')
    } catch {
      addToast('error', 'Nao foi possivel salvar o Horario de Jogo.')
    } finally {
      setSettingsBusy(false)
      setConfirmGameModeOpen(false)
    }
  }

  const toggleGameMode = () => {
    if (settingsBusy) return
    if (!settings.game_mode_enabled) {
      setConfirmGameModeOpen(true)
      return
    }
    void persistGameMode(false)
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden" style={{ background: 'var(--background)' }}>
      <Sidebar activePage={page} onNavigate={navigate} />
      <GameModeToggle settings={settings} busy={settingsBusy} onToggle={toggleGameMode} />
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="fixed md:hidden flex h-11 w-11 items-center justify-center rounded-xl text-white"
        style={{
          top: 'calc(12px + env(safe-area-inset-top))',
          right: 'calc(12px + env(safe-area-inset-right))',
          zIndex: 9999,
          background: 'rgba(15,23,42,0.92)',
          border: '1px solid rgba(148,163,184,0.28)',
          boxShadow: '0 8px 22px rgba(0,0,0,0.34)',
          backdropFilter: 'blur(6px)',
        }}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <MobileNav open={mobileMenuOpen} activePage={page} onClose={() => setMobileMenuOpen(false)} onNavigate={navigate} settings={settings} busy={settingsBusy} onToggleGameMode={toggleGameMode} />
      <GameModeConfirmModal
        open={confirmGameModeOpen}
        busy={settingsBusy}
        onCancel={() => setConfirmGameModeOpen(false)}
        onConfirm={() => persistGameMode(true)}
      />
	      <main className="flex-1 min-w-0 overflow-y-auto pt-16 md:pt-14">
        {page === 'dashboard'      && <DashboardPage onNavigate={navigate} />}
        {page === 'pipeline'       && <PipelinePage />}
        {page === 'gerar-teste'    && <GerarTesteWizard />}
        {page === 'testes'         && <TestesPage />}
        {page === 'ativar-clientes' && <AtivarClientesPage />}
        {page === 'clientes'       && <ClientesPage />}
        {page === 'contas'         && <ContasPage />}
        {page === 'renovacoes'     && <RenovacoesPage />}
        {page === 'financeiro'     && <FinanceiroPage />}
        {page === 'problemas'      && <ProblemasPage />}
        {page === 'configuracoes'  && <ConfiguracoesPage />}
        {page === 'debug'          && <DebugPage />}
      </main>
    </div>
  )
}

function GameModeToggle({ settings, busy, onToggle }: { settings: OperationalSettings; busy: boolean; onToggle: () => void }) {
  const active = settings.game_mode_enabled
  return (
    <button
      onClick={onToggle}
      disabled={busy}
      className="hidden md:flex fixed items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors disabled:opacity-70"
      style={{
        top: 'calc(12px + env(safe-area-inset-top))',
        right: 'calc(16px + env(safe-area-inset-right))',
        zIndex: 40,
        background: active ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)',
        border: active ? '1px solid rgba(245,158,11,0.30)' : '1px solid var(--border)',
        color: active ? '#fcd34d' : '#94a3b8',
      }}
      aria-pressed={active}
      title={active ? 'Horário de jogo: ON - testes 45min' : 'Horário de jogo: OFF - testes 1h15'}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: active ? '#f59e0b' : '#64748b' }} />
      <Clock3 className="h-3.5 w-3.5" />
      <span className="text-[11px] font-semibold">Horário de jogo: {active ? 'ON · 45min' : 'OFF · 1h15'}</span>
    </button>
  )
}

function GameModeMobileRow({ settings, busy, onToggle }: { settings: OperationalSettings; busy: boolean; onToggle: () => void }) {
  const active = settings.game_mode_enabled
  return (
    <button
      onClick={onToggle}
      disabled={busy}
      className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors disabled:opacity-70"
      style={{
        background: active ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.035)',
        border: active ? '1px solid rgba(245,158,11,0.30)' : '1px solid var(--border)',
      }}
      aria-pressed={active}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Clock3 className="h-4 w-4 shrink-0" style={{ color: active ? '#fcd34d' : '#94a3b8' }} />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-white">Horário de jogo</span>
          <span className="block text-[11px]" style={{ color: active ? '#fcd34d' : '#64748b' }}>
            {active ? 'Ligado - novos testes 45min' : 'Desligado - novos testes 1h15'}
          </span>
        </span>
      </span>
      <span className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: active ? '#f59e0b' : 'rgba(148,163,184,0.3)' }}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: active ? '22px' : '2px' }} />
      </span>
    </button>
  )
}

function MobileNav({ open, activePage, onClose, onNavigate, settings, busy, onToggleGameMode }: {
  open: boolean
  activePage: NavPage
  onClose: () => void
  onNavigate: (page: NavPage) => void
  settings: OperationalSettings
  busy: boolean
  onToggleGameMode: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 md:hidden"
          style={{ zIndex: 10000, background: 'rgba(3,7,18,0.72)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 w-full max-h-[86vh] overflow-y-auto rounded-t-2xl p-4"
            style={{
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
              paddingLeft: 'calc(16px + env(safe-area-inset-left))',
              paddingRight: 'calc(16px + env(safe-area-inset-right))',
              background: 'var(--background)',
              borderTop: '1px solid var(--border)',
              boxShadow: '0 -12px 34px rgba(0,0,0,0.44)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Navegação</p>
                <h2 className="text-base font-semibold text-white">Painel Central Play</h2>
              </div>
              <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400" style={{ background: 'rgba(255,255,255,0.04)' }} aria-label="Fechar menu">
                <X className="h-4 w-4" />
              </button>
            </div>
            <GameModeMobileRow settings={settings} busy={busy} onToggle={onToggleGameMode} />
            <div className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.map(({ id, label, Icon }) => {
                const active = activePage === id
                return (
                  <button
                    key={id}
                    onClick={() => onNavigate(id)}
                    className="flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium"
                    style={{
                      background: active ? 'rgba(59,130,246,0.16)' : 'rgba(255,255,255,0.035)',
                      border: active ? '1px solid rgba(59,130,246,0.34)' : '1px solid rgba(255,255,255,0.06)',
                      color: active ? '#bfdbfe' : '#cbd5e1',
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function GameModeConfirmModal({ open, busy, onCancel, onConfirm }: {
  open: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
          style={{ background: 'rgba(3,7,18,0.74)', backdropFilter: 'blur(4px)' }}
          onClick={() => {
            if (!busy) onCancel()
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="w-full max-w-md rounded-2xl p-5"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 18px 50px rgba(0,0,0,0.46)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="mb-3 text-base font-semibold text-white">Ativar Horário de Jogo?</h2>
            <p className="mb-5 text-sm leading-relaxed text-slate-400">
              Com o Horário de Jogo ativo, novos testes vão durar apenas 45 minutos em vez de 1h15. Use isso somente em dia/horário de jogo para evitar teste longo demais.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                disabled={busy}
                onClick={onCancel}
                className="h-10 rounded-xl px-4 text-sm font-medium text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
              >
                Cancelar
              </button>
              <button
                disabled={busy}
                onClick={onConfirm}
                className="h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: '#f59e0b' }}
              >
                Ativar 45 minutos
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
