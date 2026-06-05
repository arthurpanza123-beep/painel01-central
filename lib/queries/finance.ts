import { MOCK_CLIENTES, MOCK_CREDITOS, type CreditoPainel } from '@/lib/mock-data'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export type FinanceQueryResult = {
  data_source: 'mock' | 'supabase'
  metrics: {
    receitaMesAtual: number
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
  }
  porPlano: { plano: string; valor: number }[]
  creditos: CreditoPainel[]
}

type ClientRow = { id: string; status: string | null }
type RenewalRow = { plan_key: string | null; amount_cents: number | null; status: string | null; due_at: string | null }
type PaymentRow = { amount_cents: number | null; status: string | null; paid_at: string | null }
type TestRow = { status: string | null; created_at: string | null }
type CreditRow = { id: string; panel_id: string; credits_available: number | null; estimated_activations: number | null; cost_per_activation_cents: number | null; status: string | null; checked_at: string | null }
type PanelRow = { id: string; name: string }

function money(cents?: number | null): number {
  return Number(((cents || 0) / 100).toFixed(2))
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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const in30 = new Date(now.getTime() + 30 * 86400000).toISOString()
    const in60 = new Date(now.getTime() + 60 * 86400000).toISOString()
    const in90 = new Date(now.getTime() + 90 * 86400000).toISOString()

    const [clientsRes, renewalsRes, paymentsRes, testsRes, creditsRes, panelsRes] = await Promise.all([
      db.from('clients').select('id,status'),
      db.from('renewals').select('plan_key,amount_cents,status,due_at').order('due_at', { ascending: true }),
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

    const paidPayments = payments.filter((p) => p.status === 'paid')
    const receitaMesAtual = paidPayments.reduce((acc, p) => acc + money(p.amount_cents), 0)
    const forecast = (until: string) => renewals
      .filter((r) => r.status !== 'paid' && r.status !== 'cancelled' && r.due_at && r.due_at <= until)
      .reduce((acc, r) => acc + money(r.amount_cents), 0)
    const porPlanoMap = renewals.reduce<Record<string, number>>((acc, r) => {
      if (!r.amount_cents) return acc
      const plano = r.plan_key ? r.plan_key.charAt(0).toUpperCase() + r.plan_key.slice(1) : 'Sem plano'
      acc[plano] = (acc[plano] || 0) + money(r.amount_cents)
      return acc
    }, {})
    const clientesAtivos = clients.filter((c) => c.status === 'active').length
    const testesPagos = tests.filter((t) => t.status === 'converted').length
    const testesAtivosHoje = tests.filter((t) => t.status === 'active').length
    const totalTestes = tests.length
    const creditosDisponiveis = creditos.reduce((acc, c) => acc + c.saldo, 0)
    const custoEstimado = creditos.reduce((acc, c) => acc + c.custoPorAtivacao * 5, 0)

    return {
      data_source: 'supabase',
      metrics: {
        receitaMesAtual,
        receitaPrevista30d: forecast(in30),
        receitaPrevista60d: forecast(in60),
        receitaPrevista90d: forecast(in90),
        lucroEstimado: receitaMesAtual - custoEstimado,
        renovacoesPrevistas: renewals.filter((r) => r.status !== 'paid' && r.status !== 'cancelled').length,
        creditosDisponiveis,
        ticketMedio: clientesAtivos ? receitaMesAtual / clientesAtivos : 0,
        clientesAtivos,
        conversaoDia: totalTestes ? Math.round((testesPagos / totalTestes) * 100) : 0,
        testesPagos,
        testesAtivosHoje,
      },
      porPlano: Object.entries(porPlanoMap).map(([plano, valor]) => ({ plano, valor })).sort((a, b) => b.valor - a.valor),
      creditos,
    }
  } catch {
    return buildMockResult()
  }
}
