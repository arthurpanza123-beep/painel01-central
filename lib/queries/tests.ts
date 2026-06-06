import crypto from 'crypto'

import { MOCK_TESTES, type StatusTeste, type Teste } from '@/lib/mock-data'
import { formatDateBR } from '@/lib/services/date-normalizer'
import { maskDeviceKey, maskPassword, maskPhone, maskUrl, maskUsername } from '@/lib/services/masking'
import { effectiveTestExpiresAt, readOperationalSettings } from '@/lib/services/operational-settings'
import { isOperationalNoise, operationWindows } from '@/lib/services/operational-window'
import { getXcloudRemovalState, needsOperationalExpirationAction } from '@/lib/services/test-expiration-operational'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export type TestsQueryResult = {
  data_source: 'mock' | 'supabase'
  items: Teste[]
}

export type TestsQueryOptions = {
  testId?: string | null
  clientId?: string | null
}

type TestRow = {
  id: string
  client_id: string
  app_id: string | null
  panel_id: string | null
  account_id: string | null
  device_key: string | null
  provider: string | null
  provider_code: string | null
  status: string | null
  requested_at: string | null
  activated_at: string | null
  expires_at: string | null
  failed_at: string | null
  created_at: string | null
  legacy_metadata: Record<string, unknown> | null
}
type ClientRow = { id: string; name: string | null; phone_e164: string | null }
type AccountRow = { id: string; username: string | null; password_secret: string | null; m3u_url_secret: string | null; hls_url_secret: string | null }
type AppRow = { id: string; name: string; key: string }
type PanelRow = { id: string; name: string; key: string }

function codeFromSeed(seed: string): string {
  const n = parseInt(crypto.createHash('sha1').update(seed).digest('hex').slice(0, 8), 16) % 10000
  return `#${String(n).padStart(4, '0')}`
}

function mapStatus(status: string | null): StatusTeste {
  if (status === 'active' || status === 'generating' || status === 'pending') return 'ativo'
  if (status === 'converted') return 'pago'
  if (status === 'expired' || status === 'failed' || status === 'cancelled' || status === 'archived') return 'expirado'
  return 'sem_resposta'
}

function mapOperationalStatus(status: string | null, expires: string): StatusTeste {
  const mapped = mapStatus(status)
  if (mapped === 'ativo' && new Date(expires).getTime() <= Date.now()) return 'expirado'
  return mapped
}

function buildMockItems(): Teste[] {
  return MOCK_TESTES.map((teste) => ({
    ...teste,
    telefone: maskPhone(teste.telefone),
    usuario: maskUsername(teste.usuario),
    senha: maskPassword(teste.senha),
    codigo: maskDeviceKey(teste.codigo),
    m3u: teste.m3u ? maskUrl(teste.m3u) : undefined,
  }))
}

export async function getTestsData(options: TestsQueryOptions = {}): Promise<TestsQueryResult> {
  if (!isSupabaseServerConfigured) return { data_source: 'mock', items: buildMockItems() }
  const db = getSupabaseServerClient()
  if (!db) return { data_source: 'mock', items: buildMockItems() }

  try {
    const { todayStartIso } = operationWindows()
    const testSelect = 'id,client_id,app_id,panel_id,account_id,device_key,provider,provider_code,status,requested_at,activated_at,expires_at,failed_at,created_at,legacy_metadata'
    const targetTestId = String(options.testId || '').trim()
    const [settings, testsRes, targetTestRes, clientsRes, accountsRes, appsRes, panelsRes] = await Promise.all([
      readOperationalSettings(),
      db.from('tests').select(testSelect).gte('created_at', todayStartIso).order('created_at', { ascending: false }).limit(100),
      targetTestId
        ? db.from('tests').select(testSelect).eq('id', targetTestId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      db.from('clients').select('id,name,phone_e164'),
      db.from('accounts').select('id,username,password_secret,m3u_url_secret,hls_url_secret'),
      db.from('apps').select('id,name,key'),
      db.from('panels').select('id,name,key'),
    ])

    if (testsRes.error) throw new Error(testsRes.error.message)
    if (targetTestRes.error) throw new Error(targetTestRes.error.message)
    if (clientsRes.error) throw new Error(clientsRes.error.message)
    if (accountsRes.error) throw new Error(accountsRes.error.message)
    if (appsRes.error) throw new Error(appsRes.error.message)
    if (panelsRes.error) throw new Error(panelsRes.error.message)

    const clientsById = new Map((clientsRes.data as ClientRow[] || []).map((row) => [row.id, row]))
    const accountsById = new Map((accountsRes.data as AccountRow[] || []).map((row) => [row.id, row]))
    const appsById = new Map((appsRes.data as AppRow[] || []).map((row) => [row.id, row]))
    const panelsById = new Map((panelsRes.data as PanelRow[] || []).map((row) => [row.id, row]))

    const rowsById = new Map<string, TestRow>()
    for (const row of (testsRes.data as TestRow[] || [])) rowsById.set(row.id, row)
    if (targetTestRes.data) {
      const target = targetTestRes.data as TestRow
      if (!options.clientId || target.client_id === options.clientId) rowsById.set(target.id, target)
    }

    const items: Teste[] = Array.from(rowsById.values())
      .filter((test) => !isOperationalNoise(clientsById.get(test.client_id)?.name))
      .map((test) => {
      const client = clientsById.get(test.client_id)
      const account = test.account_id ? accountsById.get(test.account_id) : undefined
      const app = test.app_id ? appsById.get(test.app_id) : undefined
      const panel = test.panel_id ? panelsById.get(test.panel_id) : undefined
      const created = test.activated_at || test.requested_at || test.created_at || new Date().toISOString()
      const effective = effectiveTestExpiresAt(test, settings)
      const expires = effective.expiresAt
      const rawCode = test.device_key || test.provider_code || test.id
      const legacy = test.legacy_metadata || {}
      const metadataUsername = typeof legacy.username === 'string' ? legacy.username : typeof legacy.xtream_username === 'string' ? legacy.xtream_username : ''
      const metadataPassword = typeof legacy.xtream_password === 'string' ? legacy.xtream_password : ''
      const metadataM3u = typeof legacy.optional_m3u_url === 'string' ? legacy.optional_m3u_url : ''
      const metadataHls = typeof legacy.optional_hls_url === 'string' ? legacy.optional_hls_url : ''
      const rawUsername = account?.username || metadataUsername || ''
      const xcloudRemoval = getXcloudRemovalState({
        appKey: app?.key,
        appName: app?.name,
        deviceKey: test.device_key,
        metadata: legacy,
      })
      const canExpire = needsOperationalExpirationAction({
        status: test.status,
        appKey: app?.key,
        appName: app?.name,
        deviceKey: test.device_key,
        metadata: legacy,
      })

      return {
        id: test.id,
        cliente: client?.name || 'Cliente',
        telefone: maskPhone(client?.phone_e164 || ''),
        app: app?.name || test.provider || 'Aplicativo',
        servidor: panel?.name || test.provider || 'Servidor',
        usuario: maskUsername(rawUsername || 'usuario'),
        senha: maskPassword(account?.password_secret || metadataPassword || 'senha'),
        codigo: maskDeviceKey(rawCode) || codeFromSeed(test.id),
        m3u: account?.m3u_url_secret ? maskUrl(account.m3u_url_secret) : account?.hls_url_secret ? maskUrl(account.hls_url_secret) : metadataM3u ? maskUrl(metadataM3u) : metadataHls ? maskUrl(metadataHls) : undefined,
        status: mapOperationalStatus(test.status, expires),
        validade: `${formatDateBR(expires)} ${new Date(expires).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        expiresAt: expires,
        durationMinutes: effective.durationMinutes,
        gameModeDuration: effective.durationMinutes === 45,
        xcloudRemoved: xcloudRemoval.satisfied && xcloudRemoval.required,
        canExpire,
        copyUsername: rawUsername,
        rawStatus: test.status || '',
        criadoEm: formatDateBR(created),
        horario: new Date(created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }
    })

    return { data_source: 'supabase', items }
  } catch {
    return { data_source: 'mock', items: buildMockItems() }
  }
}
