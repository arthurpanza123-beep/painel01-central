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
  Settings, 
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
  { id: 'renovacoes',   label: 'Renovacoes',   Icon: ({ className }) => <RefreshCw className={className} /> },
  { id: 'financeiro',   label: 'Financeiro',   Icon: ({ className }) => <DollarSign className={className} /> },
  { id: 'problemas',    label: 'Problemas',    Icon: ({ className }) => <AlertTriangle className={className} /> },
  { id: 'configuracoes',label: 'Configuracoes',Icon: ({ className }) => <Settings className={className} /> },
  { id: 'debug',        label: 'Logs',         Icon: ({ className }) => <Terminal className={className} /> },
]

interface SidebarProps {
  activePage: NavPage
  onNavigate: (page: NavPage) => void
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside
      className="hidden md:flex flex-col items-center shrink-0 py-5"
      style={{
        width: 60,
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Logo mark */}
      <div
        className="mb-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden"
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

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-0.5 flex-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activePage === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              title={label}
              aria-label={label}
              className={cn(
                'group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200',
                isActive
                  ? 'text-white'
                  : 'text-[color:var(--sidebar-foreground)] hover:text-white',
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
              <Icon className="h-[18px] w-[18px]" />

              {/* Active indicator dot */}
              {isActive && (
                <span
                  className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: '#3b82f6', boxShadow: '0 0 4px #3b82f6' }}
                />
              )}

              {/* Tooltip */}
              <span
                className="pointer-events-none absolute left-[calc(100%+10px)] z-50 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{
                  background: '#1e2230',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Bottom: Sair */}
      <button
        className="group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200 text-[color:var(--sidebar-foreground)] hover:text-red-400 mt-2"
        title="Sair"
        aria-label="Sair"
      >
        <LogOut className="h-[18px] w-[18px]" />
        <span
          className="pointer-events-none absolute left-[calc(100%+10px)] z-50 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{
            background: '#1e2230',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          Sair
        </span>
      </button>
    </aside>
  )
}
