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
 * As métricas de KPI (testes ativos, gerados hoje, clientes ativos, leads em
 * andamento) excluem registros sintéticos de QA/automação via
 * isOperationalNoise, espelhando o filtro já usado em pipeline/testes/finance.
 *
 * SEGURANÇA:
 *   - Este arquivo pode ser importado em Server Components.
 *   - Não expor no client-side queries que usem service role.
 */

import type { DashboardMetrics } from '@/lib/supabase/types'
import { operationWindows, isOperationalNoise } from '@/lib/services/operational-window'
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
type ClientFinanceRow = { id: string; name: string | null; status: string | null; created_at?: string | null }
type RenewalFinanceRow = { client_id: string | null; plan_key: string | null; amount_cents: number | null; created_at: string | null }
type TestLiteRow = { id: string; client_id: string | null; status: string | null; created_at?: string | null }

function getCount(result: CountResult) {
  if (result.error) throw new Error(result.error.message || 'Falha ao consultar Supabase')
  return result.count || 0
}

function money(cents?: number | null): number {
  return Number(((cents || 0) / 100).toFixed(2))
}

function isTemporaryClient(client: ClientFinanceRow): boolean {
  return isOperationalNoise(client.name)
}

function latestRenewalsByClient(renewals: RenewalFinanceRow[]) {
  const map = new Map<string, RenewalFinanceRow>()
  for (const renewal of renewals) {
    const clientId = renewal.client_id || ''
    if (!clientId) continue
    const current = map.get(clientId)
    if (!current || String(renewal.created_at || '') > String(current.created_at || '')) {
      map.set(clientId, renewal)
    }
  }
  return map
}

function calculateMonthlyRenewalForecast(clients: ClientFinanceRow[], renewals: RenewalFinanceRow[]) {
  const latest = latestRenewalsByClient(renewals)
  return clients.reduce((total, client) => {
    if (client.status !== 'active' || isTemporaryClient(client)) return total
    const renewal = latest.get(client.id)
    if (String(renewal?.plan_key || '').toLowerCase() !== 'mensal') return total
    return total + money(renewal?.amount_cents)
  }, 0)
}

function yellowBoxOperationalCredits(): number {
  const parsed = Number(process.env.YELLOW_BOX_CREDITS || process.env.BRASIL_YELLOW_CREDITS || 9)
  return Number.isFinite(parsed) ? parsed : 9
}

async function getDashboardFromSupabase(): Promise<DashboardMetrics | null> {
  const db = getSupabaseServerClient()
  if (!db) return null

  try {
    const now = new Date()
    const { todayStartIso, in30dIso, in60dIso, in90dIso } = operationWindows(now)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const nowIso = now.toISOString()

    const [
      testsTodayRes,
      activeTestsRowsRes,
      paidPipelineRes,
      revenueMonthRes,
      forecast30Res,
      forecast60Res,
      forecast90Res,
      financeClientsRes,
      financeRenewalsRes,
      creditsRes,
    ] = await Promise.all([
      db.from('tests').select('id,client_id,status,created_at').gte('created_at', todayStartIso),
      db.from('tests').select('id,client_id,status,expires_at').eq('status', 'active').gt('expires_at', nowIso),
      db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'paid').gte('paid_at', todayStartIso),
      db.from('payments').select('amount_cents').eq('status', 'paid').gte('paid_at', monthStart),
      db.from('renewals').select('amount_cents').not('amount_cents', 'is', null).gte('due_at', nowIso).lte('due_at', in30dIso),
      db.from('renewals').select('amount_cents').not('amount_cents', 'is', null).gte('due_at', nowIso).lte('due_at', in60dIso),
      db.from('renewals').select('amount_cents').not('amount_cents', 'is', null).gte('due_at', nowIso).lte('due_at', in90dIso),
      db.from('clients').select('id,name,status,created_at'),
      db.from('renewals').select('client_id,plan_key,amount_cents,created_at'),
      db
        .from('panel_credit_snapshots')
        .select('id, credits_available, estimated_activations, status, checked_at, panels(name)')
        .order('checked_at', { ascending: false })
        .limit(12),
    ])

    if (
      testsTodayRes.error || activeTestsRowsRes.error || paidPipelineRes.error ||
      revenueMonthRes.error || forecast30Res.error || forecast60Res.error || forecast90Res.error ||
      financeClientsRes.error || financeRenewalsRes.error || creditsRes.error
    ) {
      throw new Error(
        testsTodayRes.error?.message ||
        activeTestsRowsRes.error?.message ||
        paidPipelineRes.error?.message ||
        revenueMonthRes.error?.message ||
        forecast30Res.error?.message ||
        forecast60Res.error?.message ||
        forecast90Res.error?.message ||
        financeClientsRes.error?.message ||
        financeRenewalsRes.error?.message ||
        creditsRes.error?.message ||
        'Falha ao consultar métricas'
      )
    }

    // Clientes (com nome) — base para excluir ruído de QA/automação.
    const clients = (financeClientsRes.data || []) as ClientFinanceRow[]
    const clientsById = new Map(clients.map((c) => [c.id, c]))
    const realClients = clients.filter((c) => !isOperationalNoise(c.name))
    const activeClients = realClients.filter((c) => c.status === 'active').length
    const leads = realClients.filter(
      (c) => c.status === 'lead' && String(c.created_at || '') >= todayStartIso
    ).length

    const isNoiseTest = (t: TestLiteRow) =>
      isOperationalNoise(clientsById.get(t.client_id || '')?.name)

    const testsToday = ((testsTodayRes.data || []) as TestLiteRow[]).filter((t) => !isNoiseTest(t))
    const generatedToday = testsToday.length
    const testing = testsToday.filter((t) =>
      ['pending', 'generating', 'active'].includes(String(t.status || ''))
    ).length
    const finished = testsToday.filter((t) =>
      ['expired', 'failed', 'cancelled', 'archived'].includes(String(t.status || ''))
    ).length

    const activeTests = ((activeTestsRowsRes.data || []) as TestLiteRow[])
      .filter((t) => !isNoiseTest(t)).length

    const paidPipeline = getCount(paidPipelineRes)

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

    if (!panelCredits.length) {
      panelCredits.push({
        id: 'brasil_yellow_operational_balance',
        panel: 'Brasil / Yellow Box',
        balance: yellowBoxOperationalCredits(),
        low_balance: yellowBoxOperationalCredits() <= 5,
      })
    }

    const availableCredits = panelCredits.reduce((acc, row) => acc + row.balance, 0)
    const monthlyRenewalForecast = calculateMonthlyRenewalForecast(
      clients,
      (financeRenewalsRes.data || []) as RenewalFinanceRow[]
    )

    return {
      active_tests: activeTests,
      total_tests: generatedToday,
      active_clients: activeClients,
      leads_in_progress: leads + testing + finished + paidPipeline,
      available_credits: availableCredits,
      revenue_current_month: sumCents(revenueMonthRes.data),
      monthly_renewal_forecast: monthlyRenewalForecast,
      revenue_due_30d: sumCents(forecast30Res.data),
      revenue_forecast_30d: sumCents(forecast30Res.data),
      revenue_forecast_60d: sumCents(forecast60Res.data),
      revenue_forecast_90d: sumCents(forecast90Res.data),
      funnel: [
        { stage: 'novo_lead', label: 'Lead', count: leads, color: '#3b82f6' },
        { stage: 'contato', label: 'Baixando app', count: 0, color: '#6366f1' },
        { stage: 'teste_gerado', label: 'Testando', count: testing, color: '#f59e0b' },
        { stage: 'testando', label: 'Finalizou', count: finished, color: '#eab308' },
        { stage: 'pagou', label: 'Pagou', count: paidPipeline, color: '#22c55e' },
      ],
      panel_credits: panelCredits,
      data_source: 'supabase',
    }
  } catch {
    return null
  }
}

// ─── Função pública ──────────────────────────────────────────────────────────

export async function getDashboardData(): Promise<DashboardMetrics> {
  if (isSupabaseServerConfigured) {
    const real = await getDashboardFromSupabase()
    if (real) return real
  }

  // Fallback garantido: mock sempre funciona
  return getDashboardFromMock()
}
