/**
 * lib/queries/dashboard.ts
 *
 * Camada de dados read-only para o Dashboard.
 *
 * COMPORTAMENTO:
 *   - Se NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY estiverem
 *     configuradas → tenta buscar dados reais (ainda não implementado).
 *   - Caso contrário (ou se a query falhar) → usa os mocks de lib/mock-data.ts.
 *   - NUNCA faz mutations, nunca chama API externa, nunca gera teste.
 *
 * SEGURANÇA:
 *   - Este arquivo pode ser importado em Server Components.
 *   - Não expor no client-side queries que usem service role.
 *
 * MIGRAÇÃO FUTURA:
 *   1. Instalar @supabase/supabase-js: pnpm add @supabase/supabase-js
 *   2. Descomentar o bloco "SUPABASE REAL" abaixo.
 *   3. Criar as tabelas no Supabase com o schema definido em lib/supabase/types.ts.
 *   4. Remover o fallback de mock desta função.
 */

import type { DashboardMetrics } from '@/lib/supabase/types'
import { isSupabaseServerConfigured } from '@/lib/supabase/server'
import {
  MOCK_TESTES,
  MOCK_CLIENTES,
  MOCK_PIPELINE,
  MOCK_CREDITOS,
  calcularMetricasFinanceiro,
  calcularMetricasPipeline,
} from '@/lib/mock-data'

// ─── Fallback: monta DashboardMetrics a partir dos mocks ────────────────────

function getDashboardFromMock(): DashboardMetrics {
  const fin  = calcularMetricasFinanceiro()
  const pipe = calcularMetricasPipeline()

  return {
    // KPIs — MOCK
    active_tests:       MOCK_TESTES.filter(t => t.status === 'ativo').length,
    total_tests:        MOCK_TESTES.length,
    active_clients:     MOCK_CLIENTES.filter(c => c.status === 'ativo').length,
    leads_in_progress:  MOCK_PIPELINE.filter(
      l => l.etapa !== 'ativado' && l.etapa !== 'renovacao'
    ).length,

    // Financeiro — MOCK
    available_credits:        fin.creditosDisponiveis,
    revenue_current_month:    fin.receitaMesAtual,
    revenue_forecast_30d:     fin.receitaPrevista30d,
    revenue_forecast_60d:     fin.receitaPrevista60d,
    revenue_forecast_90d:     fin.receitaPrevista90d,

    // Funil — MOCK
    funnel: [
      { stage: 'novo_lead',    label: 'Leads',     count: pipe.novo_lead + pipe.contato,           color: '#3b82f6' },
      { stage: 'testando',     label: 'Testando',  count: pipe.teste_gerado + pipe.testando,        color: '#f59e0b' },
      { stage: 'interessado',  label: 'Interesse', count: pipe.interessado,                         color: '#a78bfa' },
      { stage: 'pagou',        label: 'Pagaram',   count: pipe.pagou,                               color: '#22c55e' },
      { stage: 'ativado',      label: 'Ativados',  count: pipe.ativado,                             color: '#14b8a6' },
    ],

    // Créditos por painel — MOCK
    panel_credits: MOCK_CREDITOS.slice(0, 4).map(c => ({
      id:          c.id,
      panel:       c.painel,
      balance:     c.saldo,
      low_balance: c.alertaBaixo,
    })),

    data_source: 'mock',
  }
}

// ─── SUPABASE REAL (comentado — ativar quando banco estiver pronto) ──────────
//
// async function getDashboardFromSupabase(): Promise<DashboardMetrics | null> {
//   const db = getSupabaseServerClient()
//   if (!db) return null
//
//   try {
//     // TODO: criar views agregadas no Supabase para evitar N queries
//     const [testsRes, clientsRes, pipelineRes, creditsRes] = await Promise.all([
//       db.from('tests').select('status'),
//       db.from('clients').select('status'),
//       db.from('pipeline_leads').select('stage'),
//       db.from('integrations').select('id, name, credits, low_balance_alert'),
//     ])
//
//     if (testsRes.error || clientsRes.error || pipelineRes.error) return null
//
//     // ... mapear para DashboardMetrics ...
//     return { ..., data_source: 'supabase' }
//   } catch {
//     return null
//   }
// }

// ─── Função pública ──────────────────────────────────────────────────────────

/**
 * Retorna os dados do Dashboard.
 *
 * Tenta usar Supabase se configurado; caso contrário (ou em erro),
 * usa os dados mockados de lib/mock-data.ts.
 *
 * Esta função é SAFE para Server Components e nunca expõe service role
 * ao browser.
 */
export async function getDashboardData(): Promise<DashboardMetrics> {
  // ESTADO ATUAL: Supabase não conectado — sempre usa mock
  if (isSupabaseServerConfigured) {
    // TODO: descomentar quando banco real estiver pronto
    // const real = await getDashboardFromSupabase()
    // if (real) return real
  }

  // Fallback garantido: mock sempre funciona
  return getDashboardFromMock()
}
