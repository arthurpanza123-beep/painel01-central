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
type TestRow = {
  id: string
  client_id: string
  app_id: string | null
  panel_id: string | null
  account_id: string | null
  device_key: string | null
  status: string | null
  legacy_metadata: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}
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

const STAGE_RANK: Record<EtapaPipeline, number> = {
  novo_lead: 1,
  contato: 2,
  teste_gerado: 3,
  testando: 4,
  pagou: 5,
  interessado: 2,
  ativado: 5,
  renovacao: 5,
}

function normalizePhone(value: string | null | undefined): string {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

function mapStage(clientStatus: string | null, test?: TestRow, renewal?: RenewalRow): EtapaPipeline {
  if (isXcloudProvisioningFailure(test)) return clientStatus === 'lead' ? 'novo_lead' : 'contato'
  if (renewal?.status === 'paid' || renewal?.status === 'applied' || test?.status === 'converted') return 'pagou'
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

function mostAdvancedStage(...stages: Array<EtapaPipeline | null | undefined>): EtapaPipeline {
  return stages.filter(Boolean).reduce<EtapaPipeline>((best, stage) => {
    const next = stage as EtapaPipeline
    return STAGE_RANK[next] > STAGE_RANK[best] ? next : best
  }, 'novo_lead')
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

function isXcloudProvisioningFailure(test?: TestRow): boolean {
  if (!test || !['failed', 'cancelled'].includes(String(test.status || '').toLowerCase())) return false
  if (test.account_id) return false
  const metadata = test.legacy_metadata || {}
  const worker = metadata.xcloud_worker
  return Boolean(
    test.device_key ||
    Object.prototype.hasOwnProperty.call(metadata, 'pending_xcloud_confirmation') ||
    (worker && typeof worker === 'object' && !Array.isArray(worker)),
  )
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

function isArchivedClient(client: ClientRow): boolean {
  return ['archived', 'deleted', 'cancelled'].includes(String(client.status || '').toLowerCase())
}

function isTechnicalEvent(event: PipelineEventRow): boolean {
  const type = String(event.event_type || '').toLowerCase()
  const payload = event.payload || {}
  if (payload.fromMe === true || payload.from_me === true) return true
  if (type.includes('ignored') || type.includes('failed') || type.includes('retry')) return true
  const joined = `${type} ${JSON.stringify(payload)}`
  return isOperationalNoise(joined)
}

function newerIso(...values: Array<string | null | undefined>): string {
  return values.filter(Boolean).sort().at(-1) || new Date().toISOString()
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
    const { last24hIso } = operationWindows()
    const [eventsRes, todayClientsRes, testsRes, renewalsRes, appsRes, panelsRes] = await Promise.all([
      db.from('pipeline_events').select('id,entity_type,entity_id,event_type,to_status,payload,created_at').gte('created_at', last24hIso).order('created_at', { ascending: false }).limit(500),
      db.from('clients').select('id,name,phone_e164,status,notes,created_at,updated_at').gte('created_at', last24hIso).order('created_at', { ascending: false }).limit(150),
      db.from('tests').select('id,client_id,app_id,panel_id,account_id,device_key,status,legacy_metadata,created_at,updated_at').gte('created_at', last24hIso).order('created_at', { ascending: false }),
      db.from('renewals').select('id,client_id,amount_cents,status,created_at,updated_at').gte('created_at', last24hIso).order('created_at', { ascending: false }),
      db.from('apps').select('id,name,key'),
      db.from('panels').select('id,name,key'),
    ])

    if (eventsRes.error) throw new Error(eventsRes.error.message)
    if (todayClientsRes.error) throw new Error(todayClientsRes.error.message)
    if (testsRes.error) throw new Error(testsRes.error.message)
    if (renewalsRes.error) throw new Error(renewalsRes.error.message)
    if (appsRes.error) throw new Error(appsRes.error.message)
    if (panelsRes.error) throw new Error(panelsRes.error.message)

    const events = (eventsRes.data as PipelineEventRow[] || []).filter((event) => !isTechnicalEvent(event))
    const latestEventByClient = latestByClient(events)
    const tests = (testsRes.data as TestRow[] || [])
    const renewals = (renewalsRes.data as RenewalRow[] || [])
    const relatedClientIds = Array.from(new Set([
      ...Array.from(latestEventByClient.keys()),
      ...tests.map((test) => test.client_id).filter(Boolean),
      ...renewals.map((renewal) => renewal.client_id).filter(Boolean),
    ]))
    const eventClientsRes = relatedClientIds.length
      ? await db.from('clients').select('id,name,phone_e164,status,notes,created_at,updated_at').in('id', relatedClientIds)
      : { data: [], error: null }
    if (eventClientsRes.error) throw new Error(eventClientsRes.error.message)

    const clientsById = new Map<string, ClientRow>()
    for (const client of [...(todayClientsRes.data as ClientRow[] || []), ...(eventClientsRes.data as ClientRow[] || [])]) {
      clientsById.set(client.id, client)
    }

    const latestTestByClient = new Map<string, TestRow>()
    for (const test of tests) {
      if (!latestTestByClient.has(test.client_id)) latestTestByClient.set(test.client_id, test)
    }
    const latestRenewalByClient = new Map<string, RenewalRow>()
    for (const renewal of renewals) {
      if (renewal.client_id && !latestRenewalByClient.has(renewal.client_id)) latestRenewalByClient.set(renewal.client_id, renewal)
    }
    const appsById = new Map((appsRes.data as AppRow[] || []).map((row) => [row.id, row]))
    const panelsById = new Map((panelsRes.data as PanelRow[] || []).map((row) => [row.id, row]))

    const byDedupeKey = new Map<string, { item: LeadPipeline; rank: number; updated: string }>()

    for (const client of Array.from(clientsById.values())) {
      if (isArchivedClient(client) || isOperationalNoise(client.name) || isOperationalNoise(client.notes)) continue
      const test = latestTestByClient.get(client.id)
      const renewal = latestRenewalByClient.get(client.id)
      const event = latestEventByClient.get(client.id)
      const eventStage = isXcloudProvisioningFailure(test) ? null : stageFromEvent(event)
      const stage = mostAdvancedStage(mapStage(client.status, test, renewal), eventStage)
      if (String(client.status || '').toLowerCase() === 'active' && stage !== 'pagou') continue
      const app = test?.app_id ? appsById.get(test.app_id) : undefined
      const panel = test?.panel_id ? panelsById.get(test.panel_id) : undefined
      const updated = newerIso(event?.created_at, test?.updated_at, test?.created_at, renewal?.updated_at, renewal?.created_at, client.updated_at, client.created_at)

      const item: LeadPipeline = {
        id: client.id,
        nome: client.name || 'Cliente',
        telefone: maskPhone(client.phone_e164 || ''),
        app: app?.name,
        servidor: panel?.name,
        etapa: stage,
        valor: renewal?.amount_cents ? Number((renewal.amount_cents / 100).toFixed(2)) : undefined,
        observacoes: client.notes ? maskSensitiveText(client.notes) : undefined,
        criadoEm: formatDateTimeBR(client.created_at || updated).replace(' às ', ' '),
        atualizadoEm: formatDateTimeBR(updated).replace(' às ', ' '),
        testeId: test?.id,
        clienteId: client.id,
      }

      const dedupeKey = normalizePhone(client.phone_e164) || client.id
      const current = byDedupeKey.get(dedupeKey)
      const rank = STAGE_RANK[item.etapa] || 0
      if (!current || rank > current.rank || (rank === current.rank && updated > current.updated)) {
        byDedupeKey.set(dedupeKey, { item, rank, updated })
      }
    }

    const items = Array.from(byDedupeKey.values())
      .sort((a, b) => b.updated.localeCompare(a.updated))
      .map((entry) => entry.item)

    return { data_source: 'supabase', items }
  } catch (error) {
    console.error(`[PIPELINE_QUERY_FAILED] ${error instanceof Error ? error.message : String(error)}`)
    return { data_source: 'mock', items: buildMockItems() }
  }
}
