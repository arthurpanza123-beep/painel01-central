'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const GerarTesteWizard    = dynamic(() => import('@/components/gerar-teste/gerar-teste-wizard').then(m => ({ default: m.GerarTesteWizard })), { ssr: false })
const TestesPage           = dynamic(() => import('@/components/pages/testes-page').then(m => ({ default: m.TestesPage })), { ssr: false })
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
  | 'clientes' 
  | 'contas' 
  | 'renovacoes' 
  | 'financeiro' 
  | 'problemas' 
  | 'configuracoes' 
  | 'debug'

export default function App() {
  const [page, setPage] = useState<NavPage>('dashboard')

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ page?: NavPage }>).detail
      if (detail?.page) setPage(detail.page)
    }
    window.addEventListener('centralplay:navigate', onNavigate)
    return () => window.removeEventListener('centralplay:navigate', onNavigate)
  }, [])

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      <Sidebar activePage={page} onNavigate={setPage} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {page === 'dashboard'      && <DashboardPage onNavigate={setPage} />}
        {page === 'pipeline'       && <PipelinePage />}
        {page === 'gerar-teste'    && <GerarTesteWizard />}
        {page === 'testes'         && <TestesPage />}
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
