import crypto from 'crypto'

import { MOCK_CLIENTES, type Cliente } from '@/lib/mock-data'
import { maskPassword, maskPhone, maskUsername } from '@/lib/services/masking'
import { formatDateBR } from '@/lib/services/date-normalizer'
import { normalizeScreensCount, officialPlanLabel } from '@/lib/services/official-plans'
import { isOperationalNoise } from '@/lib/services/operational-window'
import { findAccountForClient, findSlotForClient } from '@/lib/services/account-sharing'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export type ClientsQueryResult = {
  data_source: 'mock' | 'supabase'
  items: Cliente[]
}

export type ClientsQueryOptions = {
  context?: 'default' | 'activation'
  search?: string
}

type ClientRow = {
  id: string
  name: string | null
  phone_e164: string | null
  status: string | null
  source: string | null
  notes: string | null
  created_at: string | null
  legacy_metadata: Record<string, unknown> | null
}

type AccountRow = {
  id: string
  client_id: string | null
  username: string | null
  password_secret: string | null
  max_slots: number | null
  status: string | null
  expires_at: string | null
  panel_external_id: string | null
  provider: string | null
  provider_code: string | null
  app_id: string | null
  panel_id: string | null
  legacy_metadata: Record<string, unknown> | null
  created_at: string | null
}

type SlotRow = {
  id: string
  account_id: string
  client_id: string | null
  slot_number: number | null
  status: string | null
  assigned_at: string | null
  expires_at: string | null
}

type RenewalRow = {
  id: string
  client_id: string | null
  plan_key: string | null
  amount_cents: number | null
  status: string | null
  due_at: string | null
  metadata: Record<string, unknown> | null
}

type TestRow = {
  id: string
  client_id: string
  app_id: string | null
  panel_id: string | null
  account_id: string | null
  provider: string | null
  provider_code: string | null
  status: string | null
  expires_at: string | null
  created_at: string | null
  legacy_metadata: Record<string, unknown> | null
}

type AppRow = {
  id: string
  name: string
  key: string
}

type PanelRow = {
  id: string
  name: string
  key: string
}

function codeFromSeed(seed: string): string {
  const n = parseInt(crypto.createHash('sha1').update(seed).digest('hex').slice(0, 8), 16) % 10000
  return `#${String(n).padStart(4, '0')}`
}

function mapStatus(value: string | null): Cliente['status'] {
  if (value === 'active' || value === 'ativo') return 'ativo'
  if (value === 'expired' || value === 'expirado') return 'expirado'
  if (value === 'pending' || value === 'pendente' || value === 'test_active') return 'pendente'
  return 'suspenso'
}

function mapPlan(planKey: string | null, amountCents: number | null): { plano: string; valor: number } {
  const key = String(planKey || '').toLowerCase()
  const plano =
    key === 'mensal' ? 'Mensal' :
    key === 'trimestral' ? 'Trimestral' :
    key === 'semestral' ? 'Semestral' :
    key === 'anual' ? 'Anual' :
    key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Mensal'
  return { plano, valor: Number(((amountCents || 0) / 100).toFixed(2)) }
}

function metadataNumber(metadata: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata[key] : null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function buildMockItems(): Cliente[] {
  return MOCK_CLIENTES.map((cliente) => ({
    ...cliente,
    telefone: maskPhone(cliente.telefone),
    senha: maskPassword(cliente.senha),
    usuario: maskUsername(cliente.usuario),
  }))
}

function providerDisplayName(provider?: string | null): string {
  const key = String(provider || '').toLowerCase()
  if (!key) return ''
  if (key.includes('xbr') || key.includes('devx')) return 'XBR / DevXTop'
  if (key.includes('yellow')) return 'Brasil / Yellow Box'
  if (key.includes('ninety')) return 'Ninety'
  if (key.includes('cinemax')) return 'CineMax'
  if (key.includes('area')) return 'AreaPlay'
  return provider || ''
}

function normalizeSearch(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function digitsOnly(value: unknown): string {
  return String(value || '').replace(/\D/g, '')
}

function matchesActivationSearch(input: {
  search?: string
  client: ClientRow
  account?: AccountRow | null
  test?: TestRow | null
}) {
  const query = normalizeSearch(input.search).trim()
  if (!query) return true
  const queryDigits = digitsOnly(query)
  const username = input.account?.username || testMetadataString(input.test, 'username') || testMetadataString(input.test, 'xtream_username')
  const haystack = normalizeSearch([
    input.client.name,
    input.client.phone_e164,
    username,
    input.account?.provider_code,
    input.test?.provider_code,
  ].filter(Boolean).join(' '))
  if (haystack.includes(query)) return true
  return Boolean(queryDigits && digitsOnly(input.client.phone_e164).includes(queryDigits))
}

function isTruthyMetadataFlag(metadata: Record<string, unknown> | null | undefined, key: string): boolean {
  const value = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata[key] : null
  return value === true || value === 'true' || value === 1 || value === '1'
}

function isMainOperationalClient(client: ClientRow, context: ClientsQueryOptions['context'] = 'default'): boolean {
  const status = String(client.status || '').toLowerCase()
  if (['archived', 'deleted', 'cancelled'].includes(status)) return false
  if (context !== 'activation' && ['test_active', 'lead'].includes(status)) return false
  if (isTruthyMetadataFlag(client.legacy_metadata, 'operational_noise')) return false
  const joined = [client.name, client.source, client.notes].filter(Boolean).join(' ')
  return !isOperationalNoise(joined)
}

function latestTestsByClient(tests: TestRow[]) {
  const map = new Map<string, TestRow>()
  for (const test of tests) {
    if (!test.client_id) continue
    const current = map.get(test.client_id)
    const currentDate = current?.created_at || current?.expires_at || ''
    const nextDate = test.created_at || test.expires_at || ''
    if (!current || String(nextDate) > String(currentDate)) map.set(test.client_id, test)
  }
  return map
}

function testMetadataString(test: TestRow | undefined | null, key: string): string {
  const value = test?.legacy_metadata && typeof test.legacy_metadata === 'object' && !Array.isArray(test.legacy_metadata)
    ? test.legacy_metadata[key]
    : ''
  return typeof value === 'string' ? value : ''
}

export async function getClientsData(options: ClientsQueryOptions = {}): Promise<ClientsQueryResult> {
  if (!isSupabaseServerConfigured) {
    return { data_source: 'mock', items: buildMockItems() }
  }

  const db = getSupabaseServerClient()
  if (!db) return { data_source: 'mock', items: buildMockItems() }

  try {
    const [clientsRes, accountsRes, slotsRes, renewalsRes, testsRes, appsRes, panelsRes] = await Promise.all([
      db.from('clients').select('id,name,phone_e164,status,source,notes,created_at,legacy_metadata').order('created_at', { ascending: true }),
      db.from('accounts').select('id,client_id,username,password_secret,max_slots,status,expires_at,panel_external_id,provider,provider_code,app_id,panel_id,legacy_metadata,created_at').order('created_at', { ascending: true }),
      db.from('account_slots').select('id,account_id,client_id,slot_number,status,assigned_at,expires_at').order('slot_number', { ascending: true }),
      db.from('renewals').select('id,client_id,plan_key,amount_cents,status,due_at,metadata').order('created_at', { ascending: true }),
      db.from('tests').select('id,client_id,app_id,panel_id,account_id,provider,provider_code,status,expires_at,created_at,legacy_metadata').in('status', ['pending', 'generating', 'active']).order('created_at', { ascending: true }),
      db.from('apps').select('id,name,key'),
      db.from('panels').select('id,name,key'),
    ])

    if (clientsRes.error) throw new Error(clientsRes.error.message)
    if (accountsRes.error) throw new Error(accountsRes.error.message)
    if (slotsRes.error) throw new Error(slotsRes.error.message)
    if (renewalsRes.error) throw new Error(renewalsRes.error.message)
    if (testsRes.error) throw new Error(testsRes.error.message)
    if (appsRes.error) throw new Error(appsRes.error.message)
    if (panelsRes.error) throw new Error(panelsRes.error.message)

    const appsById = new Map((appsRes.data as AppRow[] || []).map((row) => [row.id, row]))
    const panelsById = new Map((panelsRes.data as PanelRow[] || []).map((row) => [row.id, row]))
    const accounts = (accountsRes.data as AccountRow[] || [])
    const slots = (slotsRes.data as SlotRow[] || [])
    const latestActiveTestByClient = latestTestsByClient((testsRes.data as TestRow[] || []))
    const renewalByClientId = new Map((renewalsRes.data as RenewalRow[] || []).map((row) => [row.client_id || '', row]))

    const items: Cliente[] = (clientsRes.data as ClientRow[] || [])
      .filter((client) => isMainOperationalClient(client, options.context || 'default'))
      .flatMap((client) => {
      const account = findAccountForClient(client.id, accounts, slots)
      const slot = findSlotForClient(client.id, slots)
      const test = latestActiveTestByClient.get(client.id)
      if (options.context === 'activation' && !matchesActivationSearch({ search: options.search, client, account, test })) return []
      const renewal = renewalByClientId.get(client.id)
      const app = account?.app_id ? appsById.get(account.app_id) : test?.app_id ? appsById.get(test.app_id) : null
      const panel = account?.panel_id ? panelsById.get(account.panel_id) : test?.panel_id ? panelsById.get(test.panel_id) : null
      const appName = app?.name || account?.provider || test?.provider || 'Aplicativo'
      const serverName = panel?.name || providerDisplayName(account?.provider || test?.provider) || 'Servidor'
      const dueDate = renewal?.due_at || slot?.expires_at || account?.expires_at || client.created_at || ''
      const inferredTwoScreens = account?.max_slots === 2 && Number(renewal?.amount_cents || 0) >= 3000 ? 2 : 1
      const screensCount = normalizeScreensCount(
        metadataNumber(renewal?.metadata, 'screens_count') ??
        metadataNumber(client.legacy_metadata, 'screens_count') ??
        metadataNumber(account?.legacy_metadata, 'screens_count') ??
        inferredTwoScreens
      )
      const { plano, valor } = mapPlan(renewal?.plan_key || null, renewal?.amount_cents || null)
      const planWithScreens = renewal?.plan_key ? officialPlanLabel(renewal.plan_key, screensCount) : plano

      return [{
        id: client.id,
        rawStatus: client.status || '',
        activeTestId: test?.id,
        activeTestStatus: test?.status || undefined,
        nome: client.name || 'Cliente',
        telefone: maskPhone(client.phone_e164 || ''),
        app: appName,
        servidor: serverName,
        plano: planWithScreens,
        telas: screensCount,
        valor,
        vencimento: formatDateBR(dueDate),
        usuario: maskUsername(account?.username || testMetadataString(test, 'username') || testMetadataString(test, 'xtream_username') || 'usuario'),
        senha: maskPassword(account?.password_secret || testMetadataString(test, 'xtream_password') || 'senha'),
        status: mapStatus(client.status),
        criadoEm: formatDateBR(client.created_at || new Date().toISOString()),
      }]
    })

    return { data_source: 'supabase', items }
  } catch {
    return { data_source: 'mock', items: buildMockItems() }
  }
}
