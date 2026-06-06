'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { NavPage } from '@/app/page'
import {
  AlertTriangle,
  DollarSign,
  Headphones,
  Kanban,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Settings,
  Terminal,
  TestTube2,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'

const NAV_ITEMS: { id: NavPage; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: ({ className }) => <LayoutDashboard className={className} /> },
  { id: 'pipeline', label: 'Pipeline', Icon: ({ className }) => <Kanban className={className} /> },
  { id: 'gerar-teste', label: 'Gerar Teste', Icon: ({ className }) => <Headphones className={className} /> },
  { id: 'testes', label: 'Testes', Icon: ({ className }) => <TestTube2 className={className} /> },
  { id: 'ativar-clientes', label: 'Ativar Clientes', Icon: ({ className }) => <Zap className={className} /> },
  { id: 'clientes', label: 'Clientes', Icon: ({ className }) => <Users className={className} /> },
  { id: 'contas', label: 'Contas / Telas', Icon: ({ className }) => <Wallet className={className} /> },
  { id: 'renovacoes', label: 'Renovações', Icon: ({ className }) => <RefreshCw className={className} /> },
  { id: 'financeiro', label: 'Financeiro', Icon: ({ className }) => <DollarSign className={className} /> },
  { id: 'problemas', label: 'Problemas', Icon: ({ className }) => <AlertTriangle className={className} /> },
  { id: 'configuracoes', label: 'Configurações', Icon: ({ className }) => <Settings className={className} /> },
  { id: 'debug', label: 'Logs', Icon: ({ className }) => <Terminal className={className} /> },
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
      <div className="mb-6 px-1.5">
        <Image
          src="/images/central-play-logo.png"
          alt="Central Play Plus"
          width={760}
          height={380}
          priority
          className="h-auto w-full"
        />
      </div>

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
