import { MOCK_PIPELINE, type EtapaPipeline, type LeadPipeline } from '@/lib/mock-data'
import { formatDateTimeBR } from '@/lib/services/date-normalizer'
import { maskPhone, maskSensitiveText } from '@/lib/services/masking'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export type PipelineQueryResult = {
  data_source: 'mock' | 'supabase'
  items: LeadPipeline[]
}

type ClientRow = { id: string; name: string | null; phone_e164: string | null; status: string | null; notes: string | null; created_at: string | null; updated_at: string | null }
type TestRow = { id: string; client_id: string; app_id: string | null; panel_id: string | null; status: string | null; created_at: string | null; updated_at: string | null }
type RenewalRow = { id: string; client_id: string | null; amount_cents: number | null; status: string | null; created_at: string | null; updated_at: string | null }
type AppRow = { id: string; name: string; key: string }
type PanelRow = { id: string; name: string; key: string }

function mapStage(clientStatus: string | null, test?: TestRow, renewal?: RenewalRow): EtapaPipeline {
  if (renewal?.status === 'paid' || renewal?.status === 'applied') return 'renovacao'
  if (clientStatus === 'active') return 'ativado'
  if (test?.status === 'converted') return 'pagou'
  if (test?.status === 'active' || test?.status === 'generating') return 'testando'
  if (test?.status === 'pending') return 'teste_gerado'
  if (clientStatus === 'test_active') return 'teste_gerado'
  if (clientStatus === 'lead') return 'novo_lead'
  return 'contato'
}

function buildMockItems(): LeadPipeline[] {
  return MOCK_PIPELINE.map((lead) => ({
    ...lead,
    telefone: maskPhone(lead.telefone),
    observacoes: lead.observacoes ? maskSensitiveText(lead.observacoes) : undefined,
  }))
}

export async function getPipelineData(): Promise<PipelineQueryResult> {
  if (!isSupabaseServerConfigured) return { data_source: 'mock', items: buildMockItems() }
  const db = getSupabaseServerClient()
  if (!db) return { data_source: 'mock', items: buildMockItems() }

  try {
    const [clientsRes, testsRes, renewalsRes, appsRes, panelsRes] = await Promise.all([
      db.from('clients').select('id,name,phone_e164,status,notes,created_at,updated_at').order('created_at', { ascending: false }).limit(100),
      db.from('tests').select('id,client_id,app_id,panel_id,status,created_at,updated_at').order('created_at', { ascending: false }),
      db.from('renewals').select('id,client_id,amount_cents,status,created_at,updated_at').order('created_at', { ascending: false }),
      db.from('apps').select('id,name,key'),
      db.from('panels').select('id,name,key'),
    ])

    if (clientsRes.error) throw new Error(clientsRes.error.message)
    if (testsRes.error) throw new Error(testsRes.error.message)
    if (renewalsRes.error) throw new Error(renewalsRes.error.message)
    if (appsRes.error) throw new Error(appsRes.error.message)
    if (panelsRes.error) throw new Error(panelsRes.error.message)

    const latestTestByClient = new Map<string, TestRow>()
    for (const test of (testsRes.data as TestRow[] || [])) {
      if (!latestTestByClient.has(test.client_id)) latestTestByClient.set(test.client_id, test)
    }
    const latestRenewalByClient = new Map<string, RenewalRow>()
    for (const renewal of (renewalsRes.data as RenewalRow[] || [])) {
      if (renewal.client_id && !latestRenewalByClient.has(renewal.client_id)) latestRenewalByClient.set(renewal.client_id, renewal)
    }
    const appsById = new Map((appsRes.data as AppRow[] || []).map((row) => [row.id, row]))
    const panelsById = new Map((panelsRes.data as PanelRow[] || []).map((row) => [row.id, row]))

    const items: LeadPipeline[] = (clientsRes.data as ClientRow[] || []).map((client) => {
      const test = latestTestByClient.get(client.id)
      const renewal = latestRenewalByClient.get(client.id)
      const app = test?.app_id ? appsById.get(test.app_id) : undefined
      const panel = test?.panel_id ? panelsById.get(test.panel_id) : undefined
      const updated = test?.updated_at || renewal?.updated_at || client.updated_at || client.created_at || new Date().toISOString()

      return {
        id: client.id,
        nome: client.name || 'Cliente',
        telefone: maskPhone(client.phone_e164 || ''),
        app: app?.name,
        servidor: panel?.name,
        etapa: mapStage(client.status, test, renewal),
        valor: renewal?.amount_cents ? Number((renewal.amount_cents / 100).toFixed(2)) : undefined,
        observacoes: client.notes ? maskSensitiveText(client.notes) : undefined,
        criadoEm: formatDateTimeBR(client.created_at || updated).replace(' às ', ' '),
        atualizadoEm: formatDateTimeBR(updated).replace(' às ', ' '),
        testeId: test?.id,
        clienteId: client.id,
      }
    })

    return { data_source: 'supabase', items }
  } catch {
    return { data_source: 'mock', items: buildMockItems() }
  }
}
