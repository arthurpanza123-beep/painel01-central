import { MOCK_CLIENTES, MOCK_CREDITOS, type CreditoPainel } from '@/lib/mock-data'
import { isOperationalNoise, operationWindows } from '@/lib/services/operational-window'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export type FinanceQueryResult = {
  data_source: 'mock' | 'supabase'
  metrics: {
    receitaMesAtual: number
    renovacaoMensalPrevista: number
    receitaVencimento30d: number
    receitaPrevista30d: number
    receitaPrevista60d: number
    receitaPrevista90d: number
    lucroEstimado: number
    renovacoesPrevistas: number
    creditosDisponiveis: number
    ticketMedio: number
    clientesAtivos: number
    conversaoDia: number
    testesPagos: number
    testesAtivosHoje: number
    clientesContados: number
    clientesForaSoma: number
  }
  porPlano: { plano: string; valor: number }[]
  creditos: CreditoPainel[]
}

type ClientRow = { id: string; name?: string | null; status: string | null }
type RenewalRow = { client_id?: string | null; plan_key: string | null; amount_cents: number | null; status: string | null; due_at: string | null; created_at?: string | null }
type PaymentRow = { amount_cents: number | null; status: string | null; paid_at: string | null }
type TestRow = { status: string | null; created_at: string | null }
type CreditRow = { id: string; panel_id: string; credits_available: number | null; estimated_activations: number | null; cost_per_activation_cents: number | null; status: string | null; checked_at: string | null }
type PanelRow = { id: string; name: string }

function money(cents?: number | null): number {
  return Number(((cents || 0) / 100).toFixed(2))
}

function latestRenewalsByClient(renewals: RenewalRow[]): Map<string, RenewalRow> {
  const map = new Map<string, RenewalRow>()
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

function isTemporaryClient(client: ClientRow): boolean {
  return isOperationalNoise(client.name)
}

function isMonthlyPlan(planKey?: string | null): boolean {
  return String(planKey || '').toLowerCase() === 'mensal'
}

function calculateMonthlyRenewalForecast(clients: ClientRow[], renewals: RenewalRow[]) {
  const latest = latestRenewalsByClient(renewals)
  let total = 0
  let counted = 0
  let outside = 0
  const byPlan = new Map<string, number>()

  for (const client of clients) {
    if (client.status !== 'active' || isTemporaryClient(client)) continue
    const renewal = latest.get(client.id)
    const amount = money(renewal?.amount_cents)
    if (renewal && isMonthlyPlan(renewal.plan_key) && amount > 0) {
      total += amount
      counted += 1
      const plan = renewal.plan_key ? renewal.plan_key.charAt(0).toUpperCase() + renewal.plan_key.slice(1) : 'Mensal'
      byPlan.set(plan, (byPlan.get(plan) || 0) + amount)
    } else {
      outside += 1
    }
  }

  return { total, counted, outside, byPlan }
}

function yellowBoxOperationalCredits(): number {
  const parsed = Number(process.env.YELLOW_BOX_CREDITS || process.env.BRASIL_YELLOW_CREDITS || 9)
  return Number.isFinite(parsed) ? parsed : 9
}

function buildMockResult(): FinanceQueryResult {
  const clientesAtivos = MOCK_CLIENTES.filter((c) => c.status === 'ativo')
  const receitaMesAtual = clientesAtivos.reduce((acc, c) => acc + c.valor, 0)
  const creditosDisponiveis = MOCK_CREDITOS.reduce((acc, c) => acc + c.saldo, 0)
  const porPlanoMap = clientesAtivos.reduce<Record<string, number>>((acc, c) => {
    acc[c.plano] = (acc[c.plano] || 0) + c.valor
    return acc
  }, {})

  return {
    data_source: 'mock',
      metrics: {
        receitaMesAtual,
        renovacaoMensalPrevista: receitaMesAtual,
        receitaVencimento30d: receitaMesAtual,
        receitaPrevista30d: receitaMesAtual,
        receitaPrevista60d: receitaMesAtual * 2,
        receitaPrevista90d: receitaMesAtual * 3,
      lucroEstimado: receitaMesAtual - MOCK_CREDITOS.reduce((acc, c) => acc + c.custoPorAtivacao * 5, 0),
      renovacoesPrevistas: clientesAtivos.length,
      creditosDisponiveis,
      ticketMedio: clientesAtivos.length ? receitaMesAtual / clientesAtivos.length : 0,
      clientesAtivos: clientesAtivos.length,
        conversaoDia: 0,
        testesPagos: 0,
        testesAtivosHoje: 0,
        clientesContados: clientesAtivos.length,
        clientesForaSoma: 0,
      },
    porPlano: Object.entries(porPlanoMap).map(([plano, valor]) => ({ plano, valor })).sort((a, b) => b.valor - a.valor),
    creditos: MOCK_CREDITOS.map((credito) => ({ ...credito })),
  }
}

export async function getFinanceData(): Promise<FinanceQueryResult> {
  if (!isSupabaseServerConfigured) return buildMockResult()
  const db = getSupabaseServerClient()
  if (!db) return buildMockResult()

  try {
    const now = new Date()
    const windows = operationWindows(now)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const todayStart = windows.todayStartIso

    const [clientsRes, renewalsRes, paymentsRes, testsRes, creditsRes, panelsRes] = await Promise.all([
      db.from('clients').select('id,name,status'),
      db.from('renewals').select('client_id,plan_key,amount_cents,status,due_at,created_at').order('due_at', { ascending: true }),
      db.from('payments').select('amount_cents,status,paid_at').gte('paid_at', monthStart),
      db.from('tests').select('status,created_at').gte('created_at', todayStart),
      db.from('panel_credit_snapshots').select('id,panel_id,credits_available,estimated_activations,cost_per_activation_cents,status,checked_at').order('checked_at', { ascending: false }),
      db.from('panels').select('id,name'),
    ])

    if (clientsRes.error) throw new Error(clientsRes.error.message)
    if (renewalsRes.error) throw new Error(renewalsRes.error.message)
    if (paymentsRes.error) throw new Error(paymentsRes.error.message)
    if (testsRes.error) throw new Error(testsRes.error.message)
    if (creditsRes.error) throw new Error(creditsRes.error.message)
    if (panelsRes.error) throw new Error(panelsRes.error.message)

    const clients = (clientsRes.data as ClientRow[] || [])
    const renewals = (renewalsRes.data as RenewalRow[] || [])
    const payments = (paymentsRes.data as PaymentRow[] || [])
    const tests = (testsRes.data as TestRow[] || [])
    const panelsById = new Map((panelsRes.data as PanelRow[] || []).map((panel) => [panel.id, panel]))

    const latestCreditsByPanel = new Map<string, CreditRow>()
    for (const credit of (creditsRes.data as CreditRow[] || [])) {
      if (!latestCreditsByPanel.has(credit.panel_id)) latestCreditsByPanel.set(credit.panel_id, credit)
    }
    const creditos: CreditoPainel[] = Array.from(latestCreditsByPanel.values()).map((credit) => {
      const saldo = Number(credit.credits_available || 0)
      const custo = money(credit.cost_per_activation_cents)
      return {
        id: credit.id,
        painel: panelsById.get(credit.panel_id)?.name || 'Painel',
        saldo,
        custoPorAtivacao: custo,
        ativacoesRestantes: credit.estimated_activations || (custo ? Math.floor(saldo / custo) : 0),
        alertaBaixo: credit.status !== 'ok' || saldo <= Math.max(custo * 5, 50),
      }
    })
    if (!creditos.length) {
      const saldo = yellowBoxOperationalCredits()
      creditos.push({
        id: 'brasil_yellow_operational_balance',
        painel: 'Brasil / Yellow Box',
        saldo,
        custoPorAtivacao: 1,
        ativacoesRestantes: saldo,
        alertaBaixo: saldo <= 5,
      })
    }

    const paidPayments = payments.filter((p) => p.status === 'paid')
    const receitaMesAtual = paidPayments.reduce((acc, p) => acc + money(p.amount_cents), 0)
    const dueForecast = (until: string) => renewals
      .filter((r) => !['paid', 'cancelled'].includes(String(r.status || '')) && r.due_at && r.due_at >= now.toISOString() && r.due_at <= until)
      .reduce((acc, r) => acc + money(r.amount_cents), 0)
    const monthlyForecast = calculateMonthlyRenewalForecast(clients, renewals)
    const porPlanoMap = Object.fromEntries(monthlyForecast.byPlan)
    const clientesAtivos = clients.filter((c) => c.status === 'active').length
    const testesPagos = tests.filter((t) => t.status === 'converted').length
    const testesAtivosHoje = tests.filter((t) => t.status === 'active').length
    const totalTestes = tests.length
    const creditosDisponiveis = creditos.reduce((acc, c) => acc + c.saldo, 0)
    const custoEstimado = creditos.reduce((acc, c) => acc + c.custoPorAtivacao * 5, 0)
    const renovacaoMensalPrevista = Number(monthlyForecast.total.toFixed(2))
    const receitaVencimento30d = dueForecast(windows.in30dIso)
    const receitaVencimento60d = dueForecast(windows.in60dIso)
    const receitaVencimento90d = dueForecast(windows.in90dIso)

    return {
      data_source: 'supabase',
      metrics: {
        receitaMesAtual,
        renovacaoMensalPrevista,
        receitaVencimento30d,
        receitaPrevista30d: Number(receitaVencimento30d.toFixed(2)),
        receitaPrevista60d: Number(receitaVencimento60d.toFixed(2)),
        receitaPrevista90d: Number(receitaVencimento90d.toFixed(2)),
        lucroEstimado: renovacaoMensalPrevista - custoEstimado,
        renovacoesPrevistas: monthlyForecast.counted,
        creditosDisponiveis,
        ticketMedio: monthlyForecast.counted ? renovacaoMensalPrevista / monthlyForecast.counted : 0,
        clientesAtivos,
        conversaoDia: totalTestes ? Math.round((testesPagos / totalTestes) * 100) : 0,
        testesPagos,
        testesAtivosHoje,
        clientesContados: monthlyForecast.counted,
        clientesForaSoma: monthlyForecast.outside,
      },
      porPlano: Object.entries(porPlanoMap).map(([plano, valor]) => ({ plano, valor })).sort((a, b) => b.valor - a.valor),
      creditos,
    }
  } catch {
    return buildMockResult()
  }
}
