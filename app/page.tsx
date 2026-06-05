'use client'

import { useEffect, useState } from 'react'
import { GerarTesteWizard } from '@/components/gerar-teste/gerar-teste-wizard'
import { TestesPage } from '@/components/pages/testes-page'
import { ClientesPage } from '@/components/pages/clientes-page'
import { ContasPage } from '@/components/pages/contas-page'
import { RenovacoesPage } from '@/components/pages/renovacoes-page'
import { FinanceiroPage } from '@/components/pages/financeiro-page'
import { ProblemasPage } from '@/components/pages/problemas-page'
import { ConfiguracoesPage } from '@/components/pages/configuracoes-page'
import { DebugPage } from '@/components/pages/debug-page'
import { PipelinePage } from '@/components/pages/pipeline-page'
import { DashboardPage } from '@/components/pages/dashboard-page'
import { Sidebar } from '@/components/layout/sidebar'

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
