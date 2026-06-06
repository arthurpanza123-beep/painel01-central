'use client'

import { cn } from '@/lib/utils'
import type { NavPage } from '@/app/page'
import { 
  Headphones, 
  TestTube2, 
  Users, 
  Wallet, 
  RefreshCw, 
  DollarSign, 
  AlertTriangle, 
  Sparkles, 
  Terminal,
  LogOut,
  Kanban,
  LayoutDashboard,
  Zap
} from 'lucide-react'

const NAV_ITEMS: { id: NavPage; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard',    label: 'Dashboard',    Icon: ({ className }) => <LayoutDashboard className={className} /> },
  { id: 'pipeline',     label: 'Pipeline',     Icon: ({ className }) => <Kanban className={className} /> },
  { id: 'gerar-teste',  label: 'Gerar Teste',  Icon: ({ className }) => <Headphones className={className} /> },
  { id: 'testes',       label: 'Testes',       Icon: ({ className }) => <TestTube2 className={className} /> },
  { id: 'ativar-clientes', label: 'Ativar Clientes', Icon: ({ className }) => <Zap className={className} /> },
  { id: 'clientes',     label: 'Clientes',     Icon: ({ className }) => <Users className={className} /> },
  { id: 'contas',       label: 'Contas',       Icon: ({ className }) => <Wallet className={className} /> },
  { id: 'renovacoes',   label: 'Renovações',   Icon: ({ className }) => <RefreshCw className={className} /> },
  { id: 'financeiro',   label: 'Financeiro',   Icon: ({ className }) => <DollarSign className={className} /> },
  { id: 'problemas',    label: 'Problemas',    Icon: ({ className }) => <AlertTriangle className={className} /> },
  { id: 'codex',        label: 'Codex',        Icon: ({ className }) => <Sparkles className={className} /> },
  { id: 'debug',        label: 'Logs',         Icon: ({ className }) => <Terminal className={className} /> },
]

interface SidebarProps {
  activePage: NavPage
  onNavigate: (page: NavPage) => void
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside
      className="hidden md:flex flex-col shrink-0 py-5 px-3"
      style={{
        width: 212,
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Logo + nome */}
      <div className="mb-6 flex items-center gap-2.5 px-1.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden"
          style={{
            background: 'rgba(59,130,246,0.12)',
            border: '1px solid rgba(59,130,246,0.28)',
            boxShadow: '0 0 18px rgba(59,130,246,0.22)',
          }}
        >
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24" aria-label="Central Play Plus">
            <path d="M14 11L30 20L14 29V11Z" fill="#3b82f6" />
            <rect x="26" y="7" width="2" height="8" rx="1" fill="#60a5fa" opacity="0.7" />
            <rect x="23" y="10" width="8" height="2" rx="1" fill="#60a5fa" opacity="0.7" />
          </svg>
        </div>
        <span className="text-sm font-semibold leading-tight text-[color:var(--sidebar-foreground)]">
          Central Play
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activePage === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'text-white'
                  : 'text-[color:var(--sidebar-foreground)] hover:text-white hover:bg-white/5',
              )}
              style={
                isActive
                  ? {
                      background: 'rgba(59,130,246,0.18)',
                      border: '1px solid rgba(59,130,246,0.35)',
                      boxShadow: '0 0 12px rgba(59,130,246,0.2)',
                    }
                  : {}
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{label}</span>

              {/* Active indicator dot */}
              {isActive && (
                <span
                  className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: '#3b82f6', boxShadow: '0 0 4px #3b82f6' }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom: Sair */}
      <button
        className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-200 text-[color:var(--sidebar-foreground)] hover:text-red-400 hover:bg-white/5 mt-2"
        aria-label="Sair"
      >
        <LogOut className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">Sair</span>
      </button>
    </aside>
  )
}
