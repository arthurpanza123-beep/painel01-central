import { MOCK_PIPELINE, type EtapaPipeline, type LeadPipeline } from '@/lib/mock-data'
import { formatDateTimeBR } from '@/lib/services/date-normalizer'
import { maskPhone, maskSensitiveText } from '@/lib/services/masking'
import { isOperationalNoise, operationWindows } from '@/lib/services/operational-window'
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
type PipelineEventRow = {
  id: string
  entity_type: string | null
  entity_id: string | null
  event_type: string | null
  to_status: string | null
  payload: Record<string, unknown> | null
  created_at: string | null
}

function mapStage(clientStatus: string | null, test?: TestRow, renewal?: RenewalRow): EtapaPipeline {
  if (renewal?.status === 'paid' || test?.status === 'converted' || clientStatus === 'active') return 'pagou'
  if (test?.status === 'expired' || test?.status === 'failed' || test?.status === 'cancelled' || test?.status === 'archived') return 'testando'
  if (test?.status === 'active' || test?.status === 'generating' || test?.status === 'pending' || clientStatus === 'test_active') return 'teste_gerado'
  if (clientStatus === 'lead') return 'novo_lead'
  return 'contato'
}

function stageFromEvent(event?: PipelineEventRow): EtapaPipeline | null {
  const status = String(event?.to_status || '')
  if (['novo_lead', 'contato', 'teste_gerado', 'testando', 'pagou'].includes(status)) return status as EtapaPipeline

  const type = String(event?.event_type || '').toLowerCase()
  if (type.includes('install')) return 'contato'
  if (type.includes('welcome') || type.includes('inbound')) return 'novo_lead'
  if (type.includes('test_created') || type.includes('test.created')) return 'teste_gerado'
  if (type.includes('expired')) return 'testando'
  if (type.includes('activation') || type.includes('access_activated') || type.includes('renewal') || type.includes('paid')) return 'pagou'
  return null
}

function eventClientId(event: PipelineEventRow): string {
  if (event.entity_type === 'client' && event.entity_id && isUuid(event.entity_id)) return event.entity_id
  const payload = event.payload || {}
  const clientId = String(payload.client_id || payload.clientId || '')
  return isUuid(clientId) ? clientId : ''
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function latestByClient(events: PipelineEventRow[]) {
  const latest = new Map<string, PipelineEventRow>()
  for (const event of events) {
    const clientId = eventClientId(event)
    if (!clientId) continue
    const current = latest.get(clientId)
    if (!current || String(event.created_at || '') > String(current.created_at || '')) latest.set(clientId, event)
  }
  return latest
}

function buildMockItems(): LeadPipeline[] {
  const source = Array.isArray(MOCK_PIPELINE) ? MOCK_PIPELINE : []
  return source.map((lead) => ({
    ...lead,
    telefone: maskPhone(lead.telefone),
    observacoes: lead.observacoes ? maskSensitiveText(lead.observacoes) : undefined,
  })).filter((lead) => ['novo_lead', 'contato', 'teste_gerado', 'testando', 'pagou'].includes(lead.etapa))
}

export async function getPipelineData(): Promise<PipelineQueryResult> {
  if (!isSupabaseServerConfigured) {
    console.error('[PIPELINE_QUERY_FAILED] Supabase server env ausente.')
    return { data_source: 'mock', items: buildMockItems() }
  }
  const db = getSupabaseServerClient()
  if (!db) {
    console.error('[PIPELINE_QUERY_FAILED] Supabase client indisponivel.')
    return { data_source: 'mock', items: buildMockItems() }
  }

  try {
    const { todayStartIso, last24hIso } = operationWindows()
    const [eventsRes, todayClientsRes, testsRes, renewalsRes, appsRes, panelsRes] = await Promise.all([
      db.from('pipeline_events').select('id,entity_type,entity_id,event_type,to_status,payload,created_at').gte('created_at', last24hIso).order('created_at', { ascending: false }).limit(300),
      db.from('clients').select('id,name,phone_e164,status,notes,created_at,updated_at').gte('created_at', todayStartIso).order('created_at', { ascending: false }).limit(100),
      db.from('tests').select('id,client_id,app_id,panel_id,status,created_at,updated_at').gte('created_at', todayStartIso).order('created_at', { ascending: false }),
      db.from('renewals').select('id,client_id,amount_cents,status,created_at,updated_at').gte('created_at', todayStartIso).order('created_at', { ascending: false }),
      db.from('apps').select('id,name,key'),
      db.from('panels').select('id,name,key'),
    ])

    if (eventsRes.error) throw new Error(eventsRes.error.message)
    if (todayClientsRes.error) throw new Error(todayClientsRes.error.message)
    if (testsRes.error) throw new Error(testsRes.error.message)
    if (renewalsRes.error) throw new Error(renewalsRes.error.message)
    if (appsRes.error) throw new Error(appsRes.error.message)
    if (panelsRes.error) throw new Error(panelsRes.error.message)

    const events = (eventsRes.data as PipelineEventRow[] || []).filter((event) => {
      const joined = `${event.event_type || ''} ${JSON.stringify(event.payload || {})}`
      return !isOperationalNoise(joined)
    })
    const latestEventByClient = latestByClient(events)
    const eventClientIds = Array.from(latestEventByClient.keys())
    const eventClientsRes = eventClientIds.length
      ? await db.from('clients').select('id,name,phone_e164,status,notes,created_at,updated_at').in('id', eventClientIds)
      : { data: [], error: null }
    if (eventClientsRes.error) throw new Error(eventClientsRes.error.message)

    const clientsById = new Map<string, ClientRow>()
    for (const client of [...(todayClientsRes.data as ClientRow[] || []), ...(eventClientsRes.data as ClientRow[] || [])]) {
      clientsById.set(client.id, client)
    }

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

    const items: LeadPipeline[] = Array.from(clientsById.values())
      .filter((client) => !isOperationalNoise(client.name) && !isOperationalNoise(client.notes))
      .map((client) => {
      const test = latestTestByClient.get(client.id)
      const renewal = latestRenewalByClient.get(client.id)
      const event = latestEventByClient.get(client.id)
      const eventStage = stageFromEvent(event)
      const app = test?.app_id ? appsById.get(test.app_id) : undefined
      const panel = test?.panel_id ? panelsById.get(test.panel_id) : undefined
      const updated = test?.updated_at || renewal?.updated_at || client.updated_at || client.created_at || new Date().toISOString()
      const eventUpdated = event?.created_at || updated

      return {
        id: client.id,
        nome: client.name || 'Cliente',
        telefone: maskPhone(client.phone_e164 || ''),
        app: app?.name,
        servidor: panel?.name,
        etapa: eventStage || mapStage(client.status, test, renewal),
        valor: renewal?.amount_cents ? Number((renewal.amount_cents / 100).toFixed(2)) : undefined,
        observacoes: client.notes ? maskSensitiveText(client.notes) : undefined,
        criadoEm: formatDateTimeBR(client.created_at || eventUpdated).replace(' às ', ' '),
        atualizadoEm: formatDateTimeBR(eventUpdated).replace(' às ', ' '),
        testeId: test?.id,
        clienteId: client.id,
      }
    })

    return { data_source: 'supabase', items }
  } catch (error) {
    console.error(`[PIPELINE_QUERY_FAILED] ${error instanceof Error ? error.message : String(error)}`)
    return { data_source: 'mock', items: buildMockItems() }
  }
}
