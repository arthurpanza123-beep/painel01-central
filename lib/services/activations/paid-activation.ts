import { maskSensitiveText } from '@/lib/services/masking'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { findProvider } from '@/lib/config/provider-catalog'
import { createFullAdultAccess } from '@/lib/services/full-adult-provider'
import { normalizePackageType, packageMetadata, packageTypeFromMetadata, type PackageType } from '@/lib/services/package-options'
import type { ProviderTestResult } from '@/lib/services/test-generation/types'
import {
  officialPlanAmountCents,
  normalizePlanKey,
  normalizeScreensCount,
  type PlanDurationKey,
  type ScreensCount,
} from '@/lib/services/official-plans'

type JsonRecord = Record<string, unknown>

type ActivationInput = {
  test_id?: string
  client_id?: string
  client?: {
    name?: string
    phone?: string
  }
  app_id?: string
  app_key?: string
  panel_id?: string
  panel_key?: string
  plan_key?: string
  screens_count?: number
  screens?: number
  amount_cents?: number
  amount?: number
  due_at?: string
  account_id?: string
  slot_id?: string
  slot_number?: number
  force_new_account?: boolean
  create_new_account_confirmed?: boolean
  new_account?: {
    username?: string
    password_secret?: string
    provider?: string
    provider_code?: string
    panel_external_id?: string
    device_key?: string
    expires_at?: string
  }
  credentials?: {
    username?: string
    password?: string
    host?: string
    dns?: string
    smart_tv_dns?: string
    web_player?: string
    checkout_url?: string
    due_at?: string
    provider_code?: string
    code?: string
    panel_name?: string
    app_name?: string
    raw_text?: string
  }
  adult_content?: boolean
  package_type?: string
  provider_package?: string
  operator_ref?: string
}

type ClientRow = {
  id: string
  name: string | null
  phone_e164: string | null
  phone_raw: string | null
  status: string | null
  legacy_metadata: JsonRecord | null
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
  legacy_metadata: JsonRecord | null
}

type AppRow = { id: string; key: string; name: string }
type PanelRow = { id: string; key: string; name: string }

type AccountRow = {
  id: string
  app_id: string
  panel_id: string | null
  username: string | null
  password_secret: string | null
  device_key?: string | null
  provider: string | null
  provider_code: string | null
  panel_external_id: string | null
  max_slots: number | null
  status: string | null
  expires_at: string | null
  created_at?: string | null
  activated_at?: string | null
  legacy_metadata?: JsonRecord | null
}

type SlotRow = {
  id: string
  account_id: string
  client_id: string | null
  slot_number: number
  status: string | null
  assigned_at: string | null
  expires_at: string | null
}

export type ActivationRecommendation = {
  recommended: boolean
  reason: string
  account_id: string | null
  account_label: string | null
  slot_id: string | null
  slot_number: number | null
  slot_label: string | null
  requires_new_account: boolean
  capacity: number
  app_id: string | null
  panel_id: string | null
  app_key: string | null
  panel_key: string | null
  app_name: string | null
  panel_name: string | null
}

type ActivationContext = {
  client: ClientRow
  test: TestRow | null
  app: AppRow
  panel: PanelRow | null
  plan_key: string
  screens_count: ScreensCount
  amount_cents: number
  due_at: string
}

class ActivationError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function db() {
  const client = getSupabaseServerClient()
  if (!client) throw new ActivationError(500, 'SUPABASE_NOT_CONFIGURED', 'Supabase server env ausente.')
  return client
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

function normalizeLookupKey(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

const APP_ALIASES: Record<string, string> = {
  xcloud: 'xcloud',
  blessed: 'blessed',
  blessed_player: 'blessed',
  playsim: 'playsim',
  play_sim: 'playsim',
  funplay: 'funplay',
  fun_play: 'funplay',
  fun_player: 'fun_player',
  magic: 'magic',
  magic_player: 'magic',
  lotus: 'lotus',
  lotus_player: 'lotus',
  assist: 'assist_plus',
  assist_plus: 'assist_plus',
  assisti_plus: 'assist_plus',
}

const PANEL_ALIASES: Record<string, string> = {
  yellow: 'brasil_yellow',
  yellow_box: 'brasil_yellow',
  brasil_yellow: 'brasil_yellow',
  brasil_yellow_box: 'brasil_yellow',
  brasil_tv: 'brasil_yellow',
  yellow_novo: 'brasil_yellow',
  yellow_x3: 'brasil_yellow',
  yellow_x3_antigo: 'brasil_yellow',
  x3: 'brasil_yellow',
  x3_antigo: 'brasil_yellow',
  pedidospec: 'brasil_yellow',
  pedidospec_online: 'brasil_yellow',
  ninety: 'ninety',
  noventa: 'ninety',
  '90': 'ninety',
  cinemax: 'cinemax',
  cine_max: 'cinemax',
  xbr: 'devxtop_magic',
  devxtop: 'devxtop_magic',
  devx_top: 'devxtop_magic',
  xbr_devxtop: 'devxtop_magic',
  xbr_devx_top: 'devxtop_magic',
  area: 'areaplay',
  areaplay: 'areaplay',
  sigma: 'areaplay',
  areaplay_sigma: 'areaplay',
}

function resolveAppKey(input?: string): string {
  const normalized = normalizeLookupKey(input)
  return APP_ALIASES[normalized] || normalized
}

function resolvePanelKey(input?: string): string {
  const raw = String(input || '').trim()
  const normalized = normalizeLookupKey(raw)
  if (PANEL_ALIASES[normalized]) return PANEL_ALIASES[normalized]

  const provider = findProvider(raw)
  if (provider) {
    const providerKey = normalizeLookupKey(provider.key)
    return PANEL_ALIASES[providerKey] || providerKey
  }

  try {
    const host = new URL(raw).host
    const byHost = findProvider(host)
    if (byHost) {
      const providerKey = normalizeLookupKey(byHost.key)
      return PANEL_ALIASES[providerKey] || providerKey
    }
    if (host.includes('pedidospec')) return 'brasil_yellow'
  } catch {
    // Not a URL; keep alias/key lookup result.
  }

  return normalized
}

function amountToCents(input: ActivationInput, planKey: PlanDurationKey = 'mensal', screensCount: ScreensCount = 1): number {
  if (Number.isFinite(input.amount_cents)) return Math.round(Number(input.amount_cents))
  if (Number.isFinite(input.amount)) return Math.round(Number(input.amount) * 100)
  return officialPlanAmountCents(planKey, screensCount)
}

function defaultDueAt(value?: string): string {
  if (value) {
    const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    const date = br ? new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00.000Z`) : new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  const date = new Date()
  date.setMonth(date.getMonth() + 1)
  return date.toISOString()
}

function panelCapacity(panel: PanelRow | null): number {
  const key = String(panel?.key || '').toLowerCase()
  const name = String(panel?.name || '').toLowerCase()
  if (key.includes('ninety') || name.includes('ninety')) return 1
  if (key.includes('cinemax') || name.includes('cinemax')) return 2
  if (key.includes('yellow') || key.includes('brasil') || name.includes('yellow') || name.includes('brasil')) return 2
  return 1
}

function accountLabel(account: AccountRow): string {
  return account.panel_external_id ? `#${account.panel_external_id}` : `#${account.id.slice(0, 4)}`
}

function slotLabel(slotNumber: number): string {
  return `Tela ${String(slotNumber).padStart(2, '0')}`
}

function safeMessage(message: string): string {
  return maskSensitiveText(message).slice(0, 800)
}

const ACCESS_CREDENTIALS_NOT_FOUND_MESSAGE = 'Usuário e senha não foram encontrados no texto colado. Cole novamente os dados completos do painel antes de enviar ao cliente.'
const MASKED_CREDENTIAL_RE = /^(?:\*+|x{3,}|X{3,}|-+|_+|•+|●+)$/

function cleanCredential(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^[*_`"'\s]+/g, '')
    .replace(/[*_`"',.;\s]+$/g, '')
    .trim()
}

function isInvalidCredential(value: unknown): boolean {
  const text = cleanCredential(value)
  return !text || /^(?:null|undefined)$/i.test(text) || MASKED_CREDENTIAL_RE.test(text)
}

function metadataString(metadata: JsonRecord | null | undefined, key: string): string {
  const value = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata[key] : undefined
  return typeof value === 'string' ? value.trim() : ''
}

function isApp(context: ActivationContext, pattern: RegExp): boolean {
  return pattern.test(`${context.app.key} ${context.app.name}`.toLowerCase())
}

async function writeLog(event: string, level: 'info' | 'warning' | 'error' | 'success', payload: {
  client_id?: string | null
  test_id?: string | null
  account_id?: string | null
  message?: string
  metadata?: JsonRecord
}) {
  const consolePayload = {
    client_id: payload.client_id || null,
    test_id: payload.test_id || null,
    account_id: payload.account_id || null,
    ...(payload.metadata || {}),
  }
  const line = `[${event}] ${safeMessage(payload.message || event)} ${JSON.stringify(consolePayload)}`
  if (level === 'error') console.error(line)
  else if (level === 'warning') console.warn(line)
  else console.log(line)

  const database = db()
  const { error } = await database.from('logs').insert({
    scope: 'activation',
    level,
    event,
    client_id: payload.client_id || null,
    test_id: payload.test_id || null,
    account_id: payload.account_id || null,
    message: safeMessage(payload.message || event),
    metadata: payload.metadata || {},
  })
  if (error) throw new ActivationError(500, 'LOG_WRITE_FAILED', `Falha ao registrar log ${event}: ${error.message}`)
}

async function resolveApp(database: ReturnType<typeof db>, appId?: string, appKeyInput?: string): Promise<AppRow> {
  const appKey = resolveAppKey(appKeyInput)
  const query = database.from('apps').select('id,key,name')
  const { data, error } = appId && isUuid(appId)
    ? await query.eq('id', appId).maybeSingle()
    : await query.eq('key', appKey).maybeSingle()
  if (error) throw new ActivationError(500, 'APP_LOOKUP_FAILED', error.message)
  if (!data) {
    throw new ActivationError(404, 'APP_NOT_FOUND', `App nao encontrado no banco: valor recebido "${appKeyInput || appId || ''}", normalizado "${appKey}".`)
  }
  return data as AppRow
}

async function resolvePanel(database: ReturnType<typeof db>, panelId?: string | null, panelKeyInput?: string): Promise<PanelRow | null> {
  if (!panelId && !panelKeyInput) return null

  const panelKey = resolvePanelKey(panelKeyInput)
  const query = database.from('panels').select('id,key,name')
  const { data, error } = panelId && isUuid(panelId)
    ? await query.eq('id', panelId).maybeSingle()
    : await query.eq('key', panelKey).maybeSingle()
  if (error) throw new ActivationError(500, 'PANEL_LOOKUP_FAILED', error.message)
  if (!data) {
    console.error(`[ACTIVATION_PANEL_NOT_FOUND] Painel nao encontrado no banco/catalogo: valor recebido "${panelKeyInput || panelId || ''}", normalizado "${panelKey}".`)
    throw new ActivationError(404, 'PANEL_NOT_FOUND', `Painel nao encontrado no banco/catalogo: valor recebido "${panelKeyInput || panelId || ''}", normalizado "${panelKey}".`)
  }
  return data as PanelRow
}

async function resolveContext(input: ActivationInput): Promise<ActivationContext> {
  const database = db()
  let test: TestRow | null = null
  let client: ClientRow | null = null

  if (input.test_id) {
    const { data, error } = await database
      .from('tests')
      .select('id,client_id,app_id,panel_id,account_id,provider,provider_code,status,expires_at,legacy_metadata')
      .eq('id', input.test_id)
      .maybeSingle()
    if (error) throw new ActivationError(500, 'TEST_LOOKUP_FAILED', error.message)
    if (!data) throw new ActivationError(404, 'TEST_NOT_FOUND', 'Teste nao encontrado.')
    test = data as TestRow
    if (['converted', 'cancelled', 'archived'].includes(String(test.status || ''))) {
      throw new ActivationError(409, 'TEST_NOT_ACTIVATABLE', 'Teste ja convertido, cancelado ou arquivado.')
    }
  }

  const clientId = input.client_id || test?.client_id
  if (clientId) {
    const { data, error } = await database
      .from('clients')
      .select('id,name,phone_e164,phone_raw,status,legacy_metadata')
      .eq('id', clientId)
      .maybeSingle()
    if (error) throw new ActivationError(500, 'CLIENT_LOOKUP_FAILED', error.message)
    if (!data) throw new ActivationError(404, 'CLIENT_NOT_FOUND', 'Cliente nao encontrado.')
    client = data as ClientRow
  } else {
    const name = String(input.client?.name || '').trim()
    const phone = String(input.client?.phone || '').trim()
    if (!name || !phone) {
      throw new ActivationError(400, 'CLIENT_REQUIRED', 'Informe test_id, client_id ou cliente manual com nome/telefone.')
    }
    const { data, error } = await database
      .from('clients')
      .insert({
        name,
        phone_e164: normalizePhone(phone),
        phone_raw: phone,
        status: 'lead',
        source: 'manual_paid_activation',
        legacy_metadata: { created_by_activation_endpoint: true },
      })
      .select('id,name,phone_e164,phone_raw,status,legacy_metadata')
      .single()
    if (error) throw new ActivationError(500, 'CLIENT_CREATE_FAILED', error.message)
    client = data as ClientRow
  }

  let accountDefaults: { app_id: string; panel_id: string | null } | null = null
  if ((!input.app_id || !input.panel_id) && input.account_id) {
    const { data: accountData, error: accountError } = await database
      .from('accounts')
      .select('app_id,panel_id')
      .eq('id', input.account_id)
      .maybeSingle()
    if (accountError) throw new ActivationError(500, 'ACCOUNT_LOOKUP_FAILED', accountError.message)
    if (accountData) accountDefaults = accountData as { app_id: string; panel_id: string | null }
  }

  const appId = input.app_id || test?.app_id || accountDefaults?.app_id
  if (!appId && !input.app_key) throw new ActivationError(400, 'APP_REQUIRED', 'app_id/app_key e obrigatorio quando o teste nao informa app.')
  const appData = await resolveApp(database, appId || undefined, input.app_key)

  const panelId = input.panel_id || test?.panel_id || accountDefaults?.panel_id
  const panel = await resolvePanel(database, panelId, input.panel_key)

  const planKey = normalizePlanKey(input.plan_key)
  const screensCount = normalizeScreensCount(input.screens_count ?? input.screens)

  return {
    client,
    test,
    app: appData as AppRow,
    panel,
    plan_key: planKey,
    screens_count: screensCount,
    amount_cents: amountToCents(input, planKey, screensCount),
    due_at: defaultDueAt(input.due_at || input.credentials?.due_at || test?.expires_at || undefined),
  }
}

async function findFreeSlot(appId: string, panelId?: string | null, requested?: {
  account_id?: string
  slot_id?: string
  slot_number?: number
}, requiredSlots = 1, packageType: PackageType = 'no_adult'): Promise<{ account: AccountRow; slot: SlotRow; slots: SlotRow[]; capacity: number } | null> {
  const database = db()

  let query = database
    .from('accounts')
    .select('id,app_id,panel_id,username,password_secret,device_key,provider,provider_code,panel_external_id,max_slots,status,expires_at,created_at,activated_at,legacy_metadata')
    .eq('app_id', appId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (panelId) query = query.eq('panel_id', panelId)
  if (requested?.account_id) query = query.eq('id', requested.account_id)

  const { data: accountsData, error: accountsError } = await query
  if (accountsError) throw new ActivationError(500, 'ACCOUNT_LOOKUP_FAILED', accountsError.message)

  const accounts = ((accountsData || []) as AccountRow[])
    .filter((account) => packageTypeFromMetadata(account.legacy_metadata) === packageType)
    .sort((a, b) => accountCreatedKey(b).localeCompare(accountCreatedKey(a)))
  if (!accounts.length) return null

  const accountIds = accounts.map((account) => account.id)
  let slotQuery = database
    .from('account_slots')
    .select('id,account_id,client_id,slot_number,status,assigned_at,expires_at')
    .in('account_id', accountIds)
    .order('slot_number', { ascending: true })

  if (requested?.slot_id) slotQuery = slotQuery.eq('id', requested.slot_id)
  if (requested?.slot_number) slotQuery = slotQuery.eq('slot_number', requested.slot_number)

  const { data: slotsData, error: slotsError } = await slotQuery
  if (slotsError) throw new ActivationError(500, 'SLOT_LOOKUP_FAILED', slotsError.message)

  const slots = ((slotsData || []) as SlotRow[]).filter((slot) =>
    !slot.client_id && ['free', 'released'].includes(String(slot.status || 'free'))
  )
  const accountById = new Map(accounts.map((account) => [account.id, account]))
  const freeSlotsByAccount = new Map<string, SlotRow[]>()

  for (const slot of slots) {
    const list = freeSlotsByAccount.get(slot.account_id) || []
    list.push(slot)
    freeSlotsByAccount.set(slot.account_id, list)
  }

  for (const account of accounts) {
    const accountSlots = freeSlotsByAccount.get(account.id) || []
    const capacity = Math.max(Number(account.max_slots || 1), 1)
    const eligibleSlots = accountSlots
      .filter((slot) => slot.slot_number <= capacity)
      .sort((a, b) => a.slot_number - b.slot_number)
    if (eligibleSlots.length < requiredSlots) continue

    let selectedSlots = eligibleSlots.slice(0, requiredSlots)
    if (requested?.slot_id || requested?.slot_number) {
      const requestedSlot = eligibleSlots.find((slot) =>
        (requested.slot_id ? slot.id === requested.slot_id : true) &&
        (requested.slot_number ? slot.slot_number === requested.slot_number : true)
      )
      if (!requestedSlot) continue
      selectedSlots = [requestedSlot, ...eligibleSlots.filter((slot) => slot.id !== requestedSlot.id)].slice(0, requiredSlots)
    }

    const slot = selectedSlots[0]
    if (!account) continue
    if (selectedSlots.length >= requiredSlots) return { account, slot, slots: selectedSlots, capacity }
  }

  return null
}

function providerFromPanel(panel: PanelRow | null): string | null {
  const key = String(panel?.key || '').toLowerCase()
  if (key.includes('ninety')) return 'ninety'
  if (key.includes('yellow') || key.includes('brasil')) return 'yellow_box'
  if (key.includes('cinemax')) return 'cinemax'
  return key || null
}

function publicCode(appKey: string, providerCode?: string | null): string | undefined {
  if (providerCode) return providerCode
  if (appKey === 'blessed') return '1105'
  if (appKey === 'playsim' || appKey === 'assist_plus') return '187052'
  if (appKey === 'funplay') return '00112'
  return undefined
}

function accountCreatedKey(account: AccountRow): string {
  return String(account.created_at || account.activated_at || account.expires_at || '')
}

async function createConfirmedNewAccount(
  context: ActivationContext,
  input: ActivationInput,
  packageType: PackageType = 'no_adult',
  providerAccess?: ProviderTestResult | null,
): Promise<{ account: AccountRow; slot: SlotRow; slots: SlotRow[]; capacity: number }> {
  if (!input.create_new_account_confirmed) {
    throw new ActivationError(409, 'NO_FREE_SLOT', 'Nenhuma tela livre compativel encontrada. Criacao de nova conta exige confirmacao do operador.')
  }

  const username = String(input.new_account?.username || '').trim()
  const password = String(input.new_account?.password_secret || '').trim()
  if (isInvalidCredential(username) || isInvalidCredential(password)) {
    throw new ActivationError(400, 'NEW_ACCOUNT_CREDENTIALS_REQUIRED', 'Para criar nova conta, informe usuario e senha da conta paga.')
  }

  const database = db()
  const capacity = panelCapacity(context.panel)
  if (context.screens_count > capacity) {
    throw new ActivationError(409, 'PANEL_CAPACITY_INSUFFICIENT', `Este painel suporta ${capacity} tela${capacity > 1 ? 's' : ''} por conta.`)
  }
  const now = new Date().toISOString()
  const pkg = packageMetadata(packageType)
  const providerCode = publicCode(context.app.key, input.new_account?.provider_code || providerAccess?.provider_code || context.test?.provider_code || null)
  const { data: accountData, error: accountError } = await database
    .from('accounts')
    .insert({
      client_id: null,
      source_test_id: context.test?.id || null,
      app_id: context.app.id,
      panel_id: context.panel?.id || null,
      username,
      password_secret: password,
      device_key: input.new_account?.device_key || null,
      provider: input.new_account?.provider || providerFromPanel(context.panel),
      provider_code: providerCode || null,
      panel_external_id: input.new_account?.panel_external_id || providerAccess?.order_id || null,
      max_slots: capacity,
      status: 'active',
      activated_at: now,
      expires_at: input.new_account?.expires_at || context.due_at,
      legacy_metadata: {
        created_by_paid_activation: true,
        test_id: context.test?.id || null,
        ...pkg,
        host: providerAccess?.host || input.credentials?.host || null,
        dns: providerAccess?.dns || input.credentials?.dns || input.credentials?.host || null,
        provider_code: providerCode || null,
        full_adult_generated_at: packageType === 'full_adult' ? now : null,
        technical_connection: providerAccess ? {
          connection_type: 'xtream',
          optional_m3u_url: providerAccess.optional_m3u_url || null,
          optional_hls_url: providerAccess.optional_hls_url || null,
          raw_provider_response: providerAccess.raw_provider_response,
        } : null,
      },
    })
    .select('id,app_id,panel_id,username,password_secret,device_key,provider,provider_code,panel_external_id,max_slots,status,expires_at,legacy_metadata')
    .single()

  if (accountError) throw new ActivationError(500, 'ACCOUNT_CREATE_FAILED', accountError.message)
  const account = accountData as AccountRow

  const slotRows = Array.from({ length: capacity }, (_, index) => ({
    account_id: account.id,
    slot_number: index + 1,
      status: 'free',
      expires_at: context.due_at,
      metadata: { created_by_paid_activation: true, ...pkg },
    }))

  const { data: slotsData, error: slotsError } = await database
    .from('account_slots')
    .insert(slotRows)
    .select('id,account_id,client_id,slot_number,status,assigned_at,expires_at')
    .order('slot_number', { ascending: true })

  if (slotsError) {
    await database.from('accounts').delete().eq('id', account.id)
    throw new ActivationError(500, 'ACCOUNT_SLOTS_CREATE_FAILED', slotsError.message)
  }

  const createdSlots = ((slotsData || []) as SlotRow[]).sort((a, b) => a.slot_number - b.slot_number)
  const slot = createdSlots.find((row) => row.slot_number === 1)
  if (!slot) {
    await database.from('accounts').delete().eq('id', account.id)
    throw new ActivationError(500, 'ACCOUNT_SLOT_MISSING', 'Conta criada sem slot inicial.')
  }

  return { account, slot, slots: createdSlots.slice(0, context.screens_count), capacity }
}

function activationCredentials(context: ActivationContext, input: ActivationInput, account: AccountRow, requirePastedValues = false) {
  const source = input.credentials || {}
  const accountMetadata = account.legacy_metadata || {}
  const sourceOrFallback = (sourceValue: unknown, fallbackValue: unknown) => {
    const value = cleanCredential(sourceValue)
    if (value) return value
    if (requirePastedValues) return undefined
    const fallback = cleanCredential(fallbackValue)
    return fallback || undefined
  }

  return {
    username: sourceOrFallback(source.username, account.username),
    password: sourceOrFallback(source.password, account.password_secret),
    host: sourceOrFallback(source.host, metadataString(accountMetadata, 'host') || metadataString(accountMetadata, 'xtream_host')),
    dns: sourceOrFallback(source.dns || source.smart_tv_dns, metadataString(accountMetadata, 'dns') || metadataString(accountMetadata, 'smart_tv_dns')),
    smart_tv_dns: sourceOrFallback(source.smart_tv_dns, metadataString(accountMetadata, 'smart_tv_dns')),
    web_player: source.web_player || metadataString(accountMetadata, 'web_player') || undefined,
    checkout_url: source.checkout_url || metadataString(accountMetadata, 'checkout_url') || undefined,
    provider_code: sourceOrFallback(source.provider_code, account.provider_code),
    code: sourceOrFallback(source.code, account.provider_code),
    device_key: account.device_key || undefined,
    app: source.app_name || context.app.name,
    panel: source.panel_name || context.panel?.name || undefined,
  }
}

function assertActivationCredentials(context: ActivationContext, input: ActivationInput, account: AccountRow) {
  const requirePastedValues = Boolean(input.credentials?.raw_text)
  const credentials = activationCredentials(context, input, account, requirePastedValues)
  const common = [
    { key: 'username', value: credentials.username },
    { key: 'password', value: credentials.password },
  ]
  const requirements = isApp(context, /blessed/)
    ? [{ key: 'provider', value: credentials.provider_code }, ...common]
    : isApp(context, /playsim|play_sim|assist/)
      ? [{ key: 'code', value: credentials.code || credentials.provider_code }, ...common]
      : isApp(context, /xcloud|x\s*cloud/)
        ? [{ key: 'host', value: credentials.host }, ...common]
        : isApp(context, /smart_stb|smart\s*(stb|up)/)
          ? [{ key: 'dns', value: credentials.smart_tv_dns || credentials.dns || credentials.host }, ...common]
          : common

  const missing = requirements.filter((item) => isInvalidCredential(item.value))
  if (missing.length) {
    throw new ActivationError(400, 'ACCESS_CREDENTIALS_INCOMPLETE', ACCESS_CREDENTIALS_NOT_FOUND_MESSAGE)
  }

  return credentials
}

function activationCredentialMetadata(input: ActivationInput, credentials: ReturnType<typeof activationCredentials>): JsonRecord {
  const source = input.credentials || {}
  return {
    source: source.raw_text ? 'pasted_provider_text' : 'account',
    host: credentials.host || null,
    dns: credentials.dns || null,
    smart_tv_dns: credentials.smart_tv_dns || null,
    web_player: credentials.web_player || null,
    checkout_url: credentials.checkout_url || null,
    provider_code: credentials.provider_code || null,
    code: credentials.code || null,
    panel_name: credentials.panel || null,
    app_name: credentials.app || null,
    pasted_text_present: Boolean(source.raw_text),
  }
}

function providerAccessFromPastedCredentials(context: ActivationContext, input: ActivationInput): ProviderTestResult | null {
  if (!input.credentials?.raw_text) return null
  const username = cleanCredential(input.credentials.username)
  const password = cleanCredential(input.credentials.password)
  if (isInvalidCredential(username) || isInvalidCredential(password)) return null
  const providerCode = publicCode(context.app.key, input.credentials.provider_code || input.credentials.code || context.test?.provider_code || null)
  return {
    order_id: undefined,
    host: cleanCredential(input.credentials.host || input.credentials.dns) || undefined,
    username,
    password,
    provider_code: providerCode,
    dns: cleanCredential(input.credentials.dns || input.credentials.smart_tv_dns || input.credentials.host) || undefined,
    expires_at: input.credentials.due_at || context.due_at,
    optional_m3u_url: undefined,
    optional_hls_url: undefined,
    raw_provider_response: {
      provider: 'operator_pasted_full_adult',
      parsed_from: 'operator_text',
      raw_text_present: true,
    },
  }
}

export async function getActivationRecommendation(input: {
  client_id?: string
  test_id?: string
  app_id?: string
  app_key?: string
  panel_id?: string
  panel_key?: string
  account_id?: string
  slot_id?: string
  slot_number?: number
  screens_count?: number
  adult_content?: boolean
  package_type?: string
  provider_package?: string
}): Promise<ActivationRecommendation> {
  const packageType = normalizePackageType(input.package_type || input.provider_package || input.adult_content)
  const context = await resolveContext({
    client_id: input.client_id,
    test_id: input.test_id,
    app_id: input.app_id,
    app_key: input.app_key,
    panel_id: input.panel_id,
    panel_key: input.panel_key,
    account_id: input.account_id,
    screens_count: input.screens_count,
  })
  await writeLog('ACTIVATION_RECOMMENDATION_REQUESTED', 'info', {
    client_id: context.client.id,
    test_id: context.test?.id || null,
    message: 'Recomendacao de tela solicitada.',
    metadata: {
      requested_app_key: input.app_key || null,
      requested_panel_key: input.panel_key || null,
      app_key: context.app.key,
      panel_key: context.panel?.key || null,
      screens_count: context.screens_count,
      package_type: packageType,
    },
  })
  await writeLog('ACTIVATION_PROVIDER_RESOLVED', 'info', {
    client_id: context.client.id,
    test_id: context.test?.id || null,
    message: `Provider resolvido para app ${context.app.key} e painel ${context.panel?.key || 'sem painel'}.`,
    metadata: {
      app_id: context.app.id,
      app_key: context.app.key,
      app_name: context.app.name,
      panel_id: context.panel?.id || null,
      panel_key: context.panel?.key || null,
      panel_name: context.panel?.name || null,
      screens_count: context.screens_count,
    },
  })
  const found = await findFreeSlot(context.app.id, context.panel?.id || null, input, context.screens_count, packageType)
  const capacity = panelCapacity(context.panel)

  if (!found) {
    await writeLog('ACTIVATION_RECOMMENDATION_EMPTY', 'warning', {
      client_id: context.client.id,
      test_id: context.test?.id || null,
      message: 'Nenhuma tela livre encontrada para este painel/app.',
      metadata: {
        app_id: context.app.id,
        app_key: context.app.key,
        panel_id: context.panel?.id || null,
        panel_key: context.panel?.key || null,
        requires_new_account: true,
        screens_count: context.screens_count,
        package_type: packageType,
      },
    })
    return {
      recommended: false,
      reason: context.screens_count > 1 ? 'Nenhuma conta com duas telas livres. Sera necessario criar nova conta.' : 'Nenhuma tela livre. Sera necessario criar nova conta.',
      account_id: null,
      account_label: null,
      slot_id: null,
      slot_number: null,
      slot_label: null,
      requires_new_account: true,
      capacity,
      app_id: context.app.id,
      panel_id: context.panel?.id || null,
      app_key: context.app.key,
      panel_key: context.panel?.key || null,
      app_name: context.app.name,
      panel_name: context.panel?.name || null,
    }
  }

  const reason = context.screens_count > 1
    ? `Usar ${context.screens_count} telas livres da conta ${accountLabel(found.account)} economiza credito`
    : `Usar tela livre na ${slotLabel(found.slot.slot_number)} da conta ${accountLabel(found.account)} economiza credito`
  await writeLog('ACTIVATION_RECOMMENDATION_FOUND', 'info', {
    client_id: context.client.id,
    test_id: context.test?.id || null,
    account_id: found.account.id,
    message: reason,
    metadata: {
      app_id: context.app.id,
      app_key: context.app.key,
      panel_id: context.panel?.id || null,
      panel_key: context.panel?.key || null,
      slot_id: found.slot.id,
      slot_number: found.slot.slot_number,
      slot_ids: found.slots.map((slot) => slot.id),
      screens_count: context.screens_count,
      package_type: packageType,
      requires_new_account: false,
    },
  })

  return {
    recommended: true,
    reason,
    account_id: found.account.id,
    account_label: accountLabel(found.account),
    slot_id: found.slot.id,
    slot_number: found.slot.slot_number,
    slot_label: slotLabel(found.slot.slot_number),
    requires_new_account: false,
    capacity: found.capacity,
    app_id: context.app.id,
    panel_id: context.panel?.id || null,
    app_key: context.app.key,
    panel_key: context.panel?.key || null,
    app_name: context.app.name,
    panel_name: context.panel?.name || null,
  }
}

async function createPipelineEvent(eventType: string, payload: {
  entity_type: string
  entity_id: string
  from_status?: string | null
  to_status?: string | null
  operator_ref?: string | null
  payload: JsonRecord
}) {
  const database = db()
  const { error } = await database.from('pipeline_events').insert({
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    event_type: eventType,
    from_status: payload.from_status || null,
    to_status: payload.to_status || null,
    operator_ref: payload.operator_ref || null,
    payload: payload.payload,
  })
  if (error) throw new ActivationError(500, 'PIPELINE_EVENT_FAILED', error.message)
}

export async function activatePaidClient(input: ActivationInput) {
  const database = db()
  const touched: {
    slots: Array<{ id: string; previous_status: string | null; previous_client_id: string | null }>
    client?: { id: string; previous_status: string | null }
    renewal_id?: string
    test?: { id: string; previous_status: string | null; previous_account_id: string | null }
    account_id?: string
    created_account_id?: string
  } = { slots: [] }

  try {
    const packageType = normalizePackageType(input.package_type || input.provider_package || input.adult_content)
    const pkg = packageMetadata(packageType)
    const context = await resolveContext(input)
    await writeLog('ACTIVATION_STARTED', 'info', {
      client_id: context.client.id,
      test_id: context.test?.id || null,
      message: 'Ativacao real iniciada.',
      metadata: {
        requested_app_key: input.app_key || null,
        requested_panel_key: input.panel_key || null,
        app_id: context.app.id,
        app_key: context.app.key,
        panel_id: context.panel?.id || null,
        panel_key: context.panel?.key || null,
        account_id: input.account_id || null,
        slot_id: input.slot_id || null,
        screens_count: context.screens_count,
        package_type: packageType,
      },
    })
    await writeLog('ACTIVATION_PROVIDER_RESOLVED', 'info', {
      client_id: context.client.id,
      test_id: context.test?.id || null,
      message: `Ativacao resolveu app ${context.app.key} e painel ${context.panel?.key || 'sem painel'}.`,
      metadata: {
        app_id: context.app.id,
        app_key: context.app.key,
        app_name: context.app.name,
        panel_id: context.panel?.id || null,
        panel_key: context.panel?.key || null,
        panel_name: context.panel?.name || null,
        package_type: packageType,
      },
    })

    if (context.client.status === 'active') {
      throw new ActivationError(409, 'CLIENT_ALREADY_ACTIVE', 'Cliente ja esta ativo.')
    }

    let requestedSlot = await findFreeSlot(context.app.id, context.panel?.id || null, {
      account_id: input.account_id,
      slot_id: input.slot_id,
      slot_number: input.slot_number,
    }, context.screens_count, packageType)

    if (!requestedSlot) {
      if (packageType === 'full_adult') {
        const pastedAccess = providerAccessFromPastedCredentials(context, input)
        const providerAccess = pastedAccess || await createFullAdultAccess({
          client_name: context.client.name || context.client.id,
          phone: context.client.phone_e164 || context.client.phone_raw || '',
          app_key: context.app.key,
          panel_key: context.panel?.key || '',
          panel_name: context.panel?.name || '',
          device_key: input.new_account?.device_key || undefined,
        })
        requestedSlot = await createConfirmedNewAccount(context, {
          ...input,
          create_new_account_confirmed: true,
          new_account: {
            ...(input.new_account || {}),
            username: providerAccess.username,
            password_secret: providerAccess.password,
            provider: providerFromPanel(context.panel) || undefined,
            provider_code: publicCode(context.app.key, providerAccess.provider_code) || undefined,
            panel_external_id: providerAccess.order_id,
            expires_at: context.due_at,
          },
          credentials: {
            ...(input.credentials || {}),
            username: providerAccess.username,
            password: providerAccess.password,
            host: providerAccess.host,
            dns: providerAccess.dns || providerAccess.host,
            provider_code: publicCode(context.app.key, providerAccess.provider_code),
            code: publicCode(context.app.key, providerAccess.provider_code),
            due_at: providerAccess.expires_at,
          },
        }, packageType, providerAccess)
      } else {
        requestedSlot = await createConfirmedNewAccount(context, input, packageType)
      }
      touched.created_account_id = requestedSlot.account.id
    }

    const { account, slot, slots } = requestedSlot
    const credentials = assertActivationCredentials(context, input, account)
    const credentialMetadata = activationCredentialMetadata(input, credentials)
    Object.assign(credentialMetadata, pkg)
    const now = new Date().toISOString()
    const occupiedSlots: SlotRow[] = []

    for (const selectedSlot of slots) {
      const { data: occupiedSlot, error: occupyError } = await database
        .from('account_slots')
        .update({
          client_id: context.client.id,
          status: 'occupied',
          assigned_at: now,
          released_at: null,
          expires_at: context.due_at,
          metadata: {
            paid_activation: true,
            test_id: context.test?.id || null,
            app_id: context.app.id,
            panel_id: context.panel?.id || null,
            plan_key: context.plan_key,
            screens_count: context.screens_count,
            ...pkg,
            credentials: credentialMetadata,
          },
        })
        .eq('id', selectedSlot.id)
        .is('client_id', null)
        .in('status', ['free', 'released'])
        .select('id,account_id,client_id,slot_number,status,assigned_at,expires_at')
        .maybeSingle()

      if (occupyError) throw new ActivationError(500, 'SLOT_OCCUPY_FAILED', occupyError.message)
      if (!occupiedSlot) {
        await writeLog('ACTIVATION_SLOT_OCCUPIED', 'warning', {
          client_id: context.client.id,
          test_id: context.test?.id || null,
          account_id: account.id,
          message: 'Tela ja foi ocupada por outro cliente.',
          metadata: { slot_id: selectedSlot.id, slot_number: selectedSlot.slot_number },
        })
        throw new ActivationError(409, 'SLOT_ALREADY_OCCUPIED', 'Tela ja foi ocupada por outro cliente.')
      }

      occupiedSlots.push(occupiedSlot as SlotRow)
      touched.slots.push({ id: selectedSlot.id, previous_status: selectedSlot.status, previous_client_id: selectedSlot.client_id })
    }

    touched.account_id = account.id

    const accountMetadata = {
      ...(account.legacy_metadata || {}),
      paid_activation_credentials: credentialMetadata,
      paid_activation_credentials_updated_at: now,
      ...pkg,
    }
    const { error: accountMetadataError } = await database
      .from('accounts')
      .update({ legacy_metadata: accountMetadata })
      .eq('id', account.id)

    if (accountMetadataError) throw new ActivationError(500, 'ACCOUNT_METADATA_UPDATE_FAILED', accountMetadataError.message)
    account.legacy_metadata = accountMetadata

    await writeLog('ACCOUNT_SLOT_USED', 'success', {
      client_id: context.client.id,
      test_id: context.test?.id || null,
      account_id: account.id,
      message: `${context.screens_count} tela${context.screens_count > 1 ? 's' : ''} ocupada${context.screens_count > 1 ? 's' : ''} na conta ${accountLabel(account)}.`,
      metadata: {
        slot_id: slot.id,
        slot_number: slot.slot_number,
        slot_ids: occupiedSlots.map((item) => item.id),
        slot_numbers: occupiedSlots.map((item) => item.slot_number),
        screens_count: context.screens_count,
        package_type: packageType,
      },
    })

    const { error: clientError } = await database
      .from('clients')
      .update({
        status: 'active',
        legacy_metadata: {
          ...(context.client.legacy_metadata || {}),
          activated_from_test_id: context.test?.id || null,
          active_account_id: account.id,
          active_slot_id: slot.id,
          active_slot_ids: occupiedSlots.map((item) => item.id),
          screens_count: context.screens_count,
          paid_activation_at: now,
          ...pkg,
          paid_activation_credentials: credentialMetadata,
        },
      })
      .eq('id', context.client.id)

    if (clientError) throw new ActivationError(500, 'CLIENT_UPDATE_FAILED', clientError.message)
    touched.client = { id: context.client.id, previous_status: context.client.status }

    await writeLog('CLIENT_ACTIVATED', 'success', {
      client_id: context.client.id,
      test_id: context.test?.id || null,
      account_id: account.id,
      message: `Cliente ${context.client.name || context.client.id} ativado como pago.`,
      metadata: { slot_id: slot.id, slot_ids: occupiedSlots.map((item) => item.id), plan_key: context.plan_key, screens_count: context.screens_count, due_at: context.due_at, package_type: packageType },
    })

    if (context.test) {
      const { error: testError } = await database
        .from('tests')
        .update({
          status: 'converted',
          account_id: account.id,
          legacy_metadata: {
            ...(context.test.legacy_metadata || {}),
            converted_to_paid_at: now,
            active_slot_id: slot.id,
            active_slot_ids: occupiedSlots.map((item) => item.id),
            screens_count: context.screens_count,
            paid_activation: true,
            ...pkg,
          },
        })
        .eq('id', context.test.id)

      if (testError) throw new ActivationError(500, 'TEST_UPDATE_FAILED', testError.message)
      touched.test = { id: context.test.id, previous_status: context.test.status, previous_account_id: context.test.account_id }

      await writeLog('TEST_CONVERTED', 'success', {
        client_id: context.client.id,
        test_id: context.test.id,
        account_id: account.id,
        message: `Teste ${context.test.id} convertido em cliente pago.`,
        metadata: { slot_id: slot.id },
      })
    }

    const { data: renewal, error: renewalError } = await database
      .from('renewals')
      .insert({
        client_id: context.client.id,
        account_id: account.id,
        slot_id: slot.id,
        plan_key: context.plan_key,
        amount_cents: context.amount_cents,
        currency: 'BRL',
        status: 'applied',
        due_at: context.due_at,
        paid_until: context.due_at,
        confirmed_at: now,
        operator_ref: input.operator_ref || null,
        metadata: {
          paid_activation: true,
          test_id: context.test?.id || null,
          app_id: context.app.id,
          panel_id: context.panel?.id || null,
          screens_count: context.screens_count,
          ...pkg,
          slot_ids: occupiedSlots.map((item) => item.id),
          credentials: credentialMetadata,
        },
      })
      .select('id,due_at,plan_key,amount_cents,status')
      .single()

    if (renewalError) throw new ActivationError(500, 'RENEWAL_CREATE_FAILED', renewalError.message)
    touched.renewal_id = renewal.id

    await writeLog('RENEWAL_CREATED', 'success', {
      client_id: context.client.id,
      test_id: context.test?.id || null,
      account_id: account.id,
      message: `Renovacao criada para ${context.due_at}.`,
      metadata: { renewal_id: renewal.id, slot_id: slot.id, slot_ids: occupiedSlots.map((item) => item.id), amount_cents: context.amount_cents, screens_count: context.screens_count, package_type: packageType },
    })

    await createPipelineEvent('paid_activation_completed', {
      entity_type: 'client',
      entity_id: context.client.id,
      from_status: context.client.status,
      to_status: 'active',
      operator_ref: input.operator_ref || null,
      payload: {
        test_id: context.test?.id || null,
        account_id: account.id,
        slot_id: slot.id,
        app_id: context.app.id,
        panel_id: context.panel?.id || null,
        renewal_id: renewal.id,
        slot_ids: occupiedSlots.map((item) => item.id),
        screens_count: context.screens_count,
        package_type: packageType,
        reused_existing_slot: true,
      },
    })

    await writeLog('ACTIVATION_COMPLETED', 'success', {
      client_id: context.client.id,
      test_id: context.test?.id || null,
      account_id: account.id,
      message: `Ativacao concluida em ${slotLabel(slot.slot_number)} da conta ${accountLabel(account)}.`,
      metadata: {
        slot_id: slot.id,
        slot_number: slot.slot_number,
        slot_ids: occupiedSlots.map((item) => item.id),
        screens_count: context.screens_count,
        app_key: context.app.key,
        panel_key: context.panel?.key || null,
        renewal_id: renewal.id,
        pasted_credentials: Boolean(input.credentials?.raw_text),
        package_type: packageType,
      },
    })

    return {
      success: true,
      activation: {
        client_id: context.client.id,
        client_name: context.client.name,
        test_id: context.test?.id || null,
        account_id: account.id,
        account_label: accountLabel(account),
        slot_id: slot.id,
        slot_number: slot.slot_number,
        slot_label: slotLabel(slot.slot_number),
        slot_ids: occupiedSlots.map((item) => item.id),
        screens_count: context.screens_count,
        renewal_id: renewal.id,
        plan_key: context.plan_key,
        amount_cents: context.amount_cents,
        due_at: context.due_at,
        credentials,
        package_type: packageType,
        adult_content: pkg.adult_content,
        reused_existing_slot: true,
      },
    }
  } catch (error) {
    if (touched.renewal_id) {
      await database.from('renewals').delete().eq('id', touched.renewal_id)
    }
    if (touched.test) {
      await database.from('tests').update({ status: touched.test.previous_status, account_id: touched.test.previous_account_id }).eq('id', touched.test.id)
    }
    if (touched.client) {
      await database.from('clients').update({ status: touched.client.previous_status }).eq('id', touched.client.id)
    }
    for (const touchedSlot of touched.slots) {
      await database
        .from('account_slots')
        .update({
          client_id: touchedSlot.previous_client_id,
          status: touchedSlot.previous_status || 'free',
          assigned_at: null,
          expires_at: null,
        })
        .eq('id', touchedSlot.id)
    }
    if (touched.created_account_id) {
      await database.from('accounts').delete().eq('id', touched.created_account_id)
    }

    const err = error instanceof ActivationError
      ? error
      : new ActivationError(500, 'ACTIVATION_FAILED', error instanceof Error ? error.message : String(error))

    try {
      await writeLog('ACTIVATION_FAILED', 'error', {
        client_id: input.client_id || null,
        test_id: input.test_id || null,
        account_id: touched.account_id || input.account_id || null,
        message: err.message,
        metadata: { code: err.code },
      })
    } catch {
      // If logging itself fails, preserve the original activation error.
    }

    throw err
  }
}

export function activationErrorResponse(error: unknown) {
  const err = error instanceof ActivationError
    ? error
    : new ActivationError(500, 'ACTIVATION_FAILED', error instanceof Error ? error.message : String(error))

  return {
    status: err.status,
    body: {
      success: false,
      code: err.code,
      error: safeMessage(err.message),
    },
  }
}
