/**
 * lib/queries/dashboard.ts
 *
 * Camada de dados read-only para o Dashboard.
 *
 * COMPORTAMENTO:
 *   - Se NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY estiverem
 *     configuradas → tenta buscar dados reais.
 *   - Caso contrário (ou se a query falhar) → usa os mocks de lib/mock-data.ts.
 *   - NUNCA faz mutations, nunca chama API externa, nunca gera teste.
 *
 * SEGURANÇA:
 *   - Este arquivo pode ser importado em Server Components.
 *   - Não expor no client-side queries que usem service role.
 *
 * MIGRAÇÃO FUTURA:
 *   1. Criar views agregadas para reduzir queries.
 *   2. Remover o fallback de mock depois de validar staging/produção.
 */

import type { DashboardMetrics } from '@/lib/supabase/types'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'
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

// ─── SUPABASE REAL (read-only) ───────────────────────────────────────────────

type CountResult = { count: number | null; error: { message?: string } | null }

function getCount(result: CountResult) {
  if (result.error) throw new Error(result.error.message || 'Falha ao consultar Supabase')
  return result.count || 0
}

async function getDashboardFromSupabase(): Promise<DashboardMetrics | null> {
  const db = getSupabaseServerClient()
  if (!db) return null

  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const in30d = new Date(now.getTime() + 30 * 86400000).toISOString()
    const in60d = new Date(now.getTime() + 60 * 86400000).toISOString()
    const in90d = new Date(now.getTime() + 90 * 86400000).toISOString()

    const [
      totalTestsRes,
      activeTestsRes,
      activeClientsRes,
      leadsRes,
      testingRes,
      interestedRes,
      paidPipelineRes,
      activatedPipelineRes,
      revenueMonthRes,
      forecast30Res,
      forecast60Res,
      forecast90Res,
      creditsRes,
    ] = await Promise.all([
      db.from('tests').select('id', { count: 'exact', head: true }),
      db.from('tests').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('clients').select('id', { count: 'exact', head: true }).in('status', ['lead', 'test_active']),
      db.from('tests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'generating', 'active']),
      db.from('renewals').select('id', { count: 'exact', head: true }).eq('status', 'pending_payment'),
      db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'paid').gte('paid_at', monthStart),
      db.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('payments').select('amount_cents').eq('status', 'paid').gte('paid_at', monthStart),
      db.from('renewals').select('amount_cents').not('amount_cents', 'is', null).gte('due_at', now.toISOString()).lte('due_at', in30d),
      db.from('renewals').select('amount_cents').not('amount_cents', 'is', null).gte('due_at', now.toISOString()).lte('due_at', in60d),
      db.from('renewals').select('amount_cents').not('amount_cents', 'is', null).gte('due_at', now.toISOString()).lte('due_at', in90d),
      db
        .from('panel_credit_snapshots')
        .select('id, credits_available, estimated_activations, status, checked_at, panels(name)')
        .order('checked_at', { ascending: false })
        .limit(12),
    ])

    const totalTests = getCount(totalTestsRes)
    const activeTests = getCount(activeTestsRes)
    const activeClients = getCount(activeClientsRes)
    const leads = getCount(leadsRes)
    const testing = getCount(testingRes)
    const interested = getCount(interestedRes)
    const paidPipeline = getCount(paidPipelineRes)
    const activated = getCount(activatedPipelineRes)

    if (revenueMonthRes.error || forecast30Res.error || forecast60Res.error || forecast90Res.error || creditsRes.error) {
      throw new Error(
        revenueMonthRes.error?.message ||
        forecast30Res.error?.message ||
        forecast60Res.error?.message ||
        forecast90Res.error?.message ||
        creditsRes.error?.message ||
        'Falha ao consultar métricas'
      )
    }

    const sumCents = (rows: { amount_cents: number | null }[] | null) =>
      (rows || []).reduce((acc, row) => acc + (row.amount_cents || 0), 0) / 100

    const rawCredits = creditsRes.data || []
    const seenPanels = new Set<string>()
    const panelCredits = rawCredits
      .map((row) => {
        const panel = Array.isArray(row.panels) ? row.panels[0] : row.panels
        const panelName = panel && typeof panel === 'object' && 'name' in panel ? String(panel.name) : 'Painel'
        return {
          id: String(row.id),
          panel: panelName,
          balance: Number(row.credits_available || 0),
          low_balance: String(row.status || 'ok') !== 'ok',
        }
      })
      .filter((row) => {
        if (seenPanels.has(row.panel)) return false
        seenPanels.add(row.panel)
        return true
      })

    const availableCredits = panelCredits.reduce((acc, row) => acc + row.balance, 0)

    return {
      active_tests: activeTests,
      total_tests: totalTests,
      active_clients: activeClients,
      leads_in_progress: leads + testing + interested,
      available_credits: availableCredits,
      revenue_current_month: sumCents(revenueMonthRes.data),
      revenue_forecast_30d: sumCents(forecast30Res.data),
      revenue_forecast_60d: sumCents(forecast60Res.data),
      revenue_forecast_90d: sumCents(forecast90Res.data),
      funnel: [
        { stage: 'novo_lead', label: 'Leads', count: leads, color: '#3b82f6' },
        { stage: 'testando', label: 'Testando', count: testing, color: '#f59e0b' },
        { stage: 'interessado', label: 'Interesse', count: interested, color: '#a78bfa' },
        { stage: 'pagou', label: 'Pagaram', count: paidPipeline, color: '#22c55e' },
        { stage: 'ativado', label: 'Ativados', count: activated, color: '#14b8a6' },
      ],
      panel_credits: panelCredits,
      data_source: 'supabase',
    }
  } catch {
    return null
  }
}

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
  if (isSupabaseServerConfigured) {
    const real = await getDashboardFromSupabase()
    if (real) return real
  }

  // Fallback garantido: mock sempre funciona
  return getDashboardFromMock()
}
