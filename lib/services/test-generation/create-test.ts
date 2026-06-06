import { maskDeviceKey, maskPassword, maskPhone, maskSensitiveText, maskUrl, maskUsername } from '@/lib/services/masking'
import { isoPlusMinutes } from '@/lib/services/operational-window'
import { readOperationalSettings } from '@/lib/services/operational-settings'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { runXcloudWorker } from '@/lib/services/xcloud-worker'

import { generateTest } from './generate-test'
import { createYellowBoxTest } from './providers/yellow-box'
import type { GenerateTestInput, ProviderTestResult } from './types'

type JsonRecord = Record<string, unknown>

export type CreateTestInput = {
  client_name?: string
  clientName?: string
  nome?: string
  phone?: string
  telefone?: string
  app_id?: string
  app_key?: string
  app?: string
  panel_id?: string
  panel_key?: string
  provider?: string
  servidor?: string
  device_key?: string
  deviceKey?: string
  operator_ref?: string
}

type AppRow = { id: string; key: string; name: string; status: string | null }
type PanelRow = { id: string; key: string; name: string; supported_app_keys: string[] | null; status: string | null }
type ExistingClientRow = { id: string; status: string | null; legacy_metadata?: JsonRecord | null }

class TestCreateError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const APP_ALIASES: Record<string, string> = {
  xcloud: 'xcloud',
  blessed: 'blessed',
  blessed_player: 'blessed',
  playsim: 'playsim',
  play_sim: 'playsim',
  funplay: 'funplay',
  fun_play: 'funplay',
}

const PANEL_ALIASES: Record<string, string> = {
  yellow: 'brasil_yellow',
  yellowbox: 'brasil_yellow',
  yellow_box: 'brasil_yellow',
  brasil_yellow: 'brasil_yellow',
  brasiltv: 'brasil_yellow',
  brasil_tv: 'brasil_yellow',
}

const YELLOW_SUPPORTED_APPS = new Set(['xcloud', 'blessed', 'playsim', 'funplay'])
const DEFAULT_PAINEL2_URL = 'http://127.0.0.1:3002'

function db() {
  const client = getSupabaseServerClient()
  if (!client) throw new TestCreateError(500, 'SUPABASE_NOT_CONFIGURED', 'Supabase server env ausente.')
  return client
}

function normalizeKey(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function mode(): 'mock' | 'real' {
  return process.env.TEST_GENERATION_MODE === 'real' ? 'real' : 'mock'
}

function xcloudWorkerEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test(String(process.env.XCLOUD_WORKER_ENABLED || ''))
}

function autoDispatchEnabled(): boolean {
  const value = process.env.TEST_CREATED_AUTO_DISPATCH
  if (value === undefined || value === '') return true
  return /^(1|true|yes|on)$/i.test(value)
}

function publicCode(appKey: string, providerCode?: string): string | undefined {
  if (providerCode) return providerCode
  if (appKey === 'blessed') return '1105'
  if (appKey === 'playsim') return '187052'
  if (appKey === 'funplay') return '00112'
  return undefined
}

function providerName(panelKey: string): string {
  return panelKey === 'brasil_yellow' ? 'yellow_box' : panelKey
}

function safeMetadata(metadata: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(metadata, (_key, value: unknown) => {
    if (typeof value !== 'string') return value
    return maskSensitiveText(value)
  })) as JsonRecord
}

function painel2BaseUrl(): string {
  return String(process.env.PAINEL2_INTERNAL_URL || process.env.NEXT_PUBLIC_PAINEL2_URL || DEFAULT_PAINEL2_URL).replace(/\/+$/, '')
}

function dispatchSummary(payload: JsonRecord | null, idempotencyKey: string): JsonRecord {
  const ok = Boolean(payload?.ok)
  const dryRun = Boolean(payload?.dryRun)
  return {
    status: ok ? (dryRun ? 'dry_run' : 'sent') : 'failed',
    ok,
    dry_run: dryRun,
    code: typeof payload?.code === 'string' ? payload.code : null,
    message: typeof payload?.message === 'string' ? maskSensitiveText(payload.message).slice(0, 300) : null,
    already_sent: Boolean(payload?.already_sent),
    idempotency_key: idempotencyKey,
    updated_at: new Date().toISOString(),
  }
}

async function patchTestLegacyMetadata(testId: string, patch: JsonRecord) {
  const database = db()
  const { data, error } = await database
    .from('tests')
    .select('legacy_metadata')
    .eq('id', testId)
    .maybeSingle()
  if (error) throw new TestCreateError(500, 'TEST_METADATA_LOOKUP_FAILED', error.message)
  const current = ((data as { legacy_metadata?: JsonRecord } | null)?.legacy_metadata || {}) as JsonRecord
  const { error: updateError } = await database
    .from('tests')
    .update({ legacy_metadata: { ...current, ...patch } })
    .eq('id', testId)
  if (updateError) throw new TestCreateError(500, 'TEST_METADATA_UPDATE_FAILED', updateError.message)
}

async function dispatchTestCreated(input: {
  testId: string
  clientId: string
  clientName: string
  phone: string
  appName: string
  panelName: string
  pedido?: string | null
  host?: string | null
  username: string
  password: string
  providerCode?: string | null
  expiresAt: string
  operatorRef?: string | null
}): Promise<JsonRecord> {
  const idempotencyKey = `test_created:${input.testId}`
  if (!autoDispatchEnabled()) {
    return {
      status: 'skipped',
      ok: false,
      dry_run: false,
      code: 'AUTO_DISPATCH_DISABLED',
      message: 'Disparo automatico de teste desativado.',
      idempotency_key: idempotencyKey,
      updated_at: new Date().toISOString(),
    }
  }

  const response = await fetch(`${painel2BaseUrl()}/api/flows/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flow: 'test_created',
      phone: input.phone,
      idempotency_key: idempotencyKey,
      client: { name: input.clientName, phone: input.phone },
      test: {
        id: input.testId,
        client_id: input.clientId,
        app: input.appName,
        panel: input.panelName,
        pedido: input.pedido || '',
        order_id: input.pedido || '',
        host: input.host || '',
        username: input.username,
        password: input.password,
        code: input.providerCode || '',
        codigo: input.providerCode || '',
        expires_at: input.expiresAt,
      },
      context: {
        source: 'painel1_auto_test_created',
        operator_ref: input.operatorRef || 'painel_web_wizard',
        test_id: input.testId,
        client_id: input.clientId,
        idempotency_key: idempotencyKey,
      },
    }),
  })
  const payload = await response.json().catch(() => null) as JsonRecord | null
  if (!response.ok && !payload) {
    return {
      status: 'failed',
      ok: false,
      dry_run: false,
      code: `HTTP_${response.status}`,
      message: 'Painel 2 retornou resposta invalida.',
      idempotency_key: idempotencyKey,
      updated_at: new Date().toISOString(),
    }
  }
  return dispatchSummary(payload, idempotencyKey)
}

async function writeLog(event: string, level: 'info' | 'warning' | 'error' | 'success', payload: {
  client_id?: string | null
  test_id?: string | null
  message?: string
  metadata?: JsonRecord
}) {
  const database = db()
  const { error } = await database.from('logs').insert({
    scope: 'test_generation',
    level,
    event,
    client_id: payload.client_id || null,
    test_id: payload.test_id || null,
    account_id: null,
    message: maskSensitiveText(payload.message || event).slice(0, 800),
    metadata: safeMetadata(payload.metadata || {}),
  })
  if (error) throw new TestCreateError(500, 'LOG_WRITE_FAILED', `Falha ao registrar log ${event}: ${error.message}`)
}

async function createPipelineEvent(payload: {
  entity_type: string
  entity_id: string
  event_type: string
  from_status?: string | null
  to_status?: string | null
  operator_ref?: string | null
  payload: JsonRecord
}) {
  const database = db()
  const { error } = await database.from('pipeline_events').insert({
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    event_type: payload.event_type,
    from_status: payload.from_status || null,
    to_status: payload.to_status || null,
    operator_ref: payload.operator_ref || null,
    payload: safeMetadata(payload.payload),
  })
  if (error) throw new TestCreateError(500, 'PIPELINE_EVENT_FAILED', error.message)
}

async function findExistingClientByPhone(phoneE164: string): Promise<ExistingClientRow | null> {
  const database = db()
  const { data, error } = await database
    .from('clients')
    .select('id,status,legacy_metadata')
    .eq('phone_e164', phoneE164)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new TestCreateError(500, 'CLIENT_LOOKUP_FAILED', error.message)
  return data as ExistingClientRow | null
}

async function guardExistingXcloudGeneration(input: {
  clientId: string
  appId: string
  operatorRef?: string | null
}) {
  const database = db()
  const { data, error } = await database
    .from('tests')
    .select('id,status,created_at,legacy_metadata')
    .eq('client_id', input.clientId)
    .eq('app_id', input.appId)
    .in('status', ['active', 'pending', 'generating'])
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw new TestCreateError(500, 'ACTIVE_TEST_LOOKUP_FAILED', error.message)

  const now = new Date().toISOString()
  for (const row of (data || []) as Array<{ id: string; status: string | null; created_at: string | null; legacy_metadata: JsonRecord | null }>) {
    const metadata = row.legacy_metadata || {}
    const worker = metadata.xcloud_worker && typeof metadata.xcloud_worker === 'object' && !Array.isArray(metadata.xcloud_worker)
      ? metadata.xcloud_worker as JsonRecord
      : {}
    const workerStatus = String(worker.status || '').toLowerCase()
    const dispatch = metadata.dispatch && typeof metadata.dispatch === 'object' && !Array.isArray(metadata.dispatch)
      ? metadata.dispatch as JsonRecord
      : {}
    const dispatchStatus = String(dispatch.status || '').toLowerCase()

    if (workerStatus === 'failed') {
      await database.from('tests').update({
        status: 'failed',
        failed_at: now,
        legacy_metadata: {
          ...metadata,
          failed_closed_by_retry_at: now,
          failed_closed_by_retry_reason: 'xcloud_retry_after_failed_worker',
        },
      }).eq('id', row.id).then(({ error: updateError }) => {
        if (updateError) throw new TestCreateError(500, 'FAILED_TEST_CLOSE_FAILED', updateError.message)
      })
      continue
    }

    const running = workerStatus === 'running' || (!workerStatus && dispatchStatus !== 'sent')
    await writeLog('XCLOUD_DUPLICATE_GENERATION_BLOCKED', 'warning', {
      client_id: input.clientId,
      test_id: row.id,
      message: running
        ? 'Geracao XCloud duplicada bloqueada antes de chamar o provider.'
        : 'Teste XCloud ativo ja existente bloqueou nova geracao antes do provider.',
      metadata: { worker_status: workerStatus || null, dispatch_status: dispatchStatus || null, operator_ref: input.operatorRef || null },
    })
    throw new TestCreateError(
      409,
      running ? 'XCLOUD_TEST_ALREADY_RUNNING' : 'ACTIVE_XCLOUD_TEST_EXISTS',
      running
        ? 'Ja existe uma geracao XCloud em andamento para este cliente. Aguarde concluir antes de tentar novamente.'
        : 'Ja existe um teste XCloud ativo para este cliente. Expire ou converta o teste atual antes de gerar outro.',
    )
  }
}

async function cancelSupersededXcloudTests(input: {
  clientId: string
  appId: string
  newTestId: string
  deviceKey: string
}): Promise<number> {
  const deviceKey = input.deviceKey.trim().toLowerCase()
  if (!deviceKey) return 0
  const database = db()
  const { data, error } = await database
    .from('tests')
    .select('id,device_key,legacy_metadata')
    .eq('client_id', input.clientId)
    .eq('app_id', input.appId)
    .neq('id', input.newTestId)
    .in('status', ['active', 'pending', 'generating'])
  if (error) throw new TestCreateError(500, 'SUPERSEDED_TEST_LOOKUP_FAILED', error.message)

  const now = new Date().toISOString()
  const matches = (data || []) as Array<{ id: string; device_key: string | null; legacy_metadata: JsonRecord | null }>

  for (const row of matches) {
    const sameDevice = String(row.device_key || '').trim().toLowerCase() === deviceKey
    const { error: updateError } = await database
      .from('tests')
      .update({
        status: 'cancelled',
        legacy_metadata: {
          ...(row.legacy_metadata || {}),
          superseded_by_test_id: input.newTestId,
          superseded_at: now,
          superseded_reason: sameDevice ? 'xcloud_retry_same_device' : 'xcloud_retry_same_client',
        },
      })
      .eq('id', row.id)
    if (updateError) throw new TestCreateError(500, 'SUPERSEDED_TEST_UPDATE_FAILED', updateError.message)
  }

  return matches.length
}

async function getCurrentTestState(testId: string): Promise<{ status: string | null; legacy_metadata: JsonRecord }> {
  const database = db()
  const { data, error } = await database
    .from('tests')
    .select('status,legacy_metadata')
    .eq('id', testId)
    .maybeSingle()
  if (error) throw new TestCreateError(500, 'TEST_STATE_LOOKUP_FAILED', error.message)
  const row = data as { status: string | null; legacy_metadata: JsonRecord | null } | null
  return { status: row?.status || null, legacy_metadata: row?.legacy_metadata || {} }
}

async function assertTestStillCurrent(testId: string) {
  const current = await getCurrentTestState(testId)
  if (current.status !== 'active' || current.legacy_metadata.superseded_by_test_id) {
    throw new TestCreateError(409, 'TEST_SUPERSEDED', 'Esta tentativa foi substituida por uma geracao mais recente. Nenhuma mensagem foi enviada.')
  }
}

async function markXcloudGenerationFailed(input: {
  testId: string
  clientId: string
  worker: JsonRecord
}) {
  const database = db()
  const now = new Date().toISOString()
  const current = await getCurrentTestState(input.testId)
  if (current.status !== 'active' || current.legacy_metadata.superseded_by_test_id) return

  const { error: updateTestError } = await database
    .from('tests')
    .update({
      status: 'failed',
      failed_at: now,
      legacy_metadata: {
        ...current.legacy_metadata,
        xcloud_worker: {
          ...((current.legacy_metadata.xcloud_worker && typeof current.legacy_metadata.xcloud_worker === 'object' && !Array.isArray(current.legacy_metadata.xcloud_worker)) ? current.legacy_metadata.xcloud_worker as JsonRecord : {}),
          ...input.worker,
          status: 'failed',
          updated_at: now,
        },
        dispatch: {
          status: 'skipped',
          ok: false,
          code: 'XCLOUD_WORKER_FAILED',
          message: 'Mensagem nao enviada porque o XCloud nao confirmou ativacao da device.',
          updated_at: now,
        },
      },
    })
    .eq('id', input.testId)
  if (updateTestError) throw new TestCreateError(500, 'TEST_FAIL_UPDATE_FAILED', updateTestError.message)

  const { count } = await database
    .from('tests')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', input.clientId)
    .neq('id', input.testId)
    .in('status', ['active', 'pending', 'generating'])

  if (!count) {
    const { data: clientData } = await database
      .from('clients')
      .select('legacy_metadata')
      .eq('id', input.clientId)
      .maybeSingle()
    const clientMetadata = ((clientData as { legacy_metadata?: JsonRecord } | null)?.legacy_metadata || {}) as JsonRecord
    await database
      .from('clients')
      .update({
        status: 'lead',
        legacy_metadata: {
          ...clientMetadata,
          latest_failed_test_id: input.testId,
          latest_xcloud_failure_at: now,
        },
      })
      .eq('id', input.clientId)
      .eq('status', 'test_active')
      .then(() => null)
  }
}

async function resolveApp(appId: string | undefined, appKeyInput: string | undefined): Promise<AppRow> {
  const database = db()
  const appKey = APP_ALIASES[normalizeKey(appKeyInput)] || normalizeKey(appKeyInput)
  const query = database.from('apps').select('id,key,name,status')
  const { data, error } = appId && isUuid(appId)
    ? await query.eq('id', appId).maybeSingle()
    : await query.eq('key', appKey).maybeSingle()
  if (error) throw new TestCreateError(500, 'APP_LOOKUP_FAILED', error.message)
  if (!data) throw new TestCreateError(404, 'APP_NOT_FOUND', 'App nao encontrado.')
  const app = data as AppRow
  if (!YELLOW_SUPPORTED_APPS.has(app.key)) throw new TestCreateError(400, 'APP_NOT_SUPPORTED', 'App ainda nao suportado na geracao real de teste.')
  if (app.status && app.status !== 'enabled') throw new TestCreateError(409, 'APP_DISABLED', 'App desabilitado.')
  return app
}

async function resolvePanel(panelId: string | undefined, panelKeyInput: string | undefined): Promise<PanelRow> {
  const database = db()
  const panelKey = PANEL_ALIASES[normalizeKey(panelKeyInput)] || normalizeKey(panelKeyInput || 'yellow')
  const query = database.from('panels').select('id,key,name,supported_app_keys,status')
  const { data, error } = panelId && isUuid(panelId)
    ? await query.eq('id', panelId).maybeSingle()
    : await query.eq('key', panelKey).maybeSingle()
  if (error) throw new TestCreateError(500, 'PANEL_LOOKUP_FAILED', error.message)
  if (!data) throw new TestCreateError(404, 'PANEL_NOT_FOUND', 'Painel nao encontrado.')
  const panel = data as PanelRow
  if (panel.key !== 'brasil_yellow') throw new TestCreateError(400, 'PANEL_NOT_IMPLEMENTED', 'Geracao real implementada inicialmente apenas para Yellow Box.')
  if (panel.status && panel.status !== 'enabled') throw new TestCreateError(409, 'PANEL_DISABLED', 'Painel desabilitado.')
  return panel
}

async function callProvider(input: {
  client_name: string
  phone: string
  app: AppRow
  panel: PanelRow
  device_key?: string
}): Promise<ProviderTestResult> {
  if (mode() === 'mock') {
    const generated = await generateTest({
      clientName: input.client_name,
      phone: input.phone,
      app: input.app.key as GenerateTestInput['app'],
      provider: 'yellowbox',
      deviceKey: input.device_key,
    })
    return {
      order_id: generated.testId,
      host: generated.xtream_host,
      username: generated.xtream_username || '',
      password: generated.xtream_password || '',
      provider_code: generated.provider_code,
      dns: generated.xtream_host,
      expires_at: generated.expires_at,
      optional_m3u_url: generated.optional_m3u_url,
      optional_hls_url: generated.optional_hls_url,
      raw_provider_response: { mode: 'mock', provider_payload: generated.legacy_metadata.provider_payload },
    }
  }

  return createYellowBoxTest({
    client_name: input.client_name,
    phone: input.phone,
    app_key: input.app.key,
    device_key: input.device_key,
  })
}

function publicTestMessage(input: {
  clientName: string
  appName: string
  host?: string
  username: string
  password: string
  providerCode?: string
  expiresAt: string
}) {
  return [
    'Teste ativado com sucesso!',
    '',
    `Cliente: ${input.clientName}`,
    `App: ${input.appName}`,
    input.providerCode ? `Codigo: ${input.providerCode}` : '',
    input.host ? `Host: ${input.host}` : '',
    `Usuario: ${input.username}`,
    `Senha: ${input.password}`,
    `Validade: ${input.expiresAt}`,
  ].filter(Boolean).join('\n')
}

export async function createGeneratedTest(input: CreateTestInput) {
  const startedAt = new Date().toISOString()
  const testMode = mode()
  const clientName = String(input.client_name || input.clientName || input.nome || '').trim()
  const phoneRaw = String(input.phone || input.telefone || '').trim()
  const phoneE164 = normalizePhone(phoneRaw)
  const deviceKey = String(input.device_key || input.deviceKey || '').trim()
  const operatorRef = String(input.operator_ref || '').trim() || null

  try {
    if (!clientName || !phoneRaw || !phoneE164) {
      throw new TestCreateError(400, 'VALIDATION_FAILED', 'Campos obrigatorios: client_name e phone.')
    }

    await writeLog('TEST_CREATE_STARTED', 'info', {
      message: `Inicio da geracao de teste para ${clientName}.`,
      metadata: { phone: maskPhone(phoneRaw), mode: testMode, operator_ref: operatorRef },
    })

    const app = await resolveApp(input.app_id, input.app_key || input.app)
    const panel = await resolvePanel(input.panel_id, input.panel_key || input.provider || input.servidor)

    if (!panel.supported_app_keys?.includes(app.key)) {
      throw new TestCreateError(400, 'APP_PANEL_INCOMPATIBLE', 'App e painel nao sao compativeis.')
    }
    if (app.key === 'xcloud' && !deviceKey) {
      throw new TestCreateError(400, 'DEVICE_KEY_REQUIRED', 'device_key e obrigatoria para XCloud.')
    }

    const database = db()
    const existingClient = await findExistingClientByPhone(phoneE164)
    if (app.key === 'xcloud' && existingClient?.id) {
      await guardExistingXcloudGeneration({
        clientId: existingClient.id,
        appId: app.id,
        operatorRef,
      })
    }

    await writeLog('TEST_PROVIDER_SELECTED', 'info', {
      message: `Provider selecionado: ${panel.name}.`,
      metadata: { app_key: app.key, panel_key: panel.key, provider: providerName(panel.key), operator_ref: operatorRef },
    })
    await writeLog('YELLOW_BOX_TEST_START', 'info', {
      message: `Iniciando teste Yellow Box para app=${app.key}.`,
      metadata: { app_key: app.key, phone: maskPhone(phoneRaw), device_key: deviceKey ? maskDeviceKey(deviceKey) : null, operator_ref: operatorRef },
    })

    const providerResult = await callProvider({ client_name: clientName, phone: phoneE164, app, panel, device_key: deviceKey || undefined })
    if (!providerResult.username || !providerResult.password) {
      throw new TestCreateError(502, 'PROVIDER_PAYLOAD_INCOMPLETE', 'Provider retornou teste sem usuario/senha.')
    }

    await writeLog('YELLOW_BOX_TEST_OK', 'success', {
      message: 'Teste Yellow Box gerado.',
      metadata: {
        order_id: providerResult.order_id || null,
        host: providerResult.host || null,
        username: maskUsername(providerResult.username),
        password: maskPassword(providerResult.password),
        has_m3u: Boolean(providerResult.optional_m3u_url),
        expires_at: providerResult.expires_at,
        operator_ref: operatorRef,
      },
    })

    const now = new Date().toISOString()
    const operationalSettings = await readOperationalSettings()
    const durationMinutes = operationalSettings.test_duration_minutes
    const expiresAt = isoPlusMinutes(durationMinutes, new Date(now))
    const existing = existingClient

    const clientPayload = {
      name: clientName,
      phone_e164: phoneE164,
      phone_raw: phoneRaw,
      status: 'test_active',
      source: testMode === 'real' ? 'test_generation_real' : 'test_generation_mock',
      legacy_metadata: {
        ...(existing?.legacy_metadata || {}),
        app_key: app.key,
        panel_key: panel.key,
        latest_test_started_at: startedAt,
        test_does_not_consume_slot: true,
      },
      updated_at: now,
    }

    const clientResult = existing
      ? await database.from('clients').update(clientPayload).eq('id', existing.id).select('id,name,status').single()
      : await database.from('clients').insert({ ...clientPayload, created_at: now }).select('id,name,status').single()
    if (clientResult.error) throw new TestCreateError(500, 'CLIENT_SAVE_FAILED', clientResult.error.message)
    const client = clientResult.data as { id: string; name: string; status: string }

    const providerCode = publicCode(app.key, providerResult.provider_code)
    const testResult = await database.from('tests').insert({
      client_id: client.id,
      app_id: app.id,
      panel_id: panel.id,
      account_id: null,
      device_type: app.key === 'xcloud' ? 'xcloud_device' : 'any',
      device_key: app.key === 'xcloud' ? deviceKey : null,
      provider: providerName(panel.key),
      provider_code: providerCode || null,
      status: 'active',
      source: testMode === 'real' ? 'test_generation_real' : 'test_generation_mock',
      requested_at: startedAt,
      activated_at: now,
      expires_at: expiresAt,
      legacy_metadata: {
        order_id: providerResult.order_id || null,
        host: providerResult.host || null,
        dns: providerResult.dns || null,
        username: providerResult.username,
        password: providerResult.password,
        provider_code: providerCode || null,
        duration_minutes: durationMinutes,
        game_mode_enabled: operationalSettings.game_mode_enabled,
        test_does_not_consume_slot: true,
        no_account_created: true,
        no_account_slot_created: true,
        technical_connection: {
          connection_type: 'xtream',
          optional_m3u_url: providerResult.optional_m3u_url || null,
          optional_hls_url: providerResult.optional_hls_url || null,
          raw_provider_response: providerResult.raw_provider_response,
        },
      },
    }).select('id,status,expires_at').single()
    if (testResult.error) throw new TestCreateError(500, 'TEST_SAVE_FAILED', testResult.error.message)
    const test = testResult.data as { id: string; status: string; expires_at: string | null }

    await createPipelineEvent({
      entity_type: 'test',
      entity_id: test.id,
      event_type: 'test_created',
      from_status: null,
      to_status: 'active',
      operator_ref: input.operator_ref || null,
      payload: {
        client_id: client.id,
        app_id: app.id,
        panel_id: panel.id,
        provider: providerName(panel.key),
        order_id: providerResult.order_id || null,
        duration_minutes: durationMinutes,
        game_mode_enabled: operationalSettings.game_mode_enabled,
        test_does_not_consume_slot: true,
      },
    })

    await writeLog('TEST_CREATED', 'success', {
      client_id: client.id,
      test_id: test.id,
      message: `Teste criado para ${clientName} | app=${app.key} panel=${panel.key}.`,
      metadata: { order_id: providerResult.order_id || null, expires_at: expiresAt, duration_minutes: durationMinutes, game_mode_enabled: operationalSettings.game_mode_enabled, operator_ref: operatorRef },
    })

    if (app.key === 'xcloud' && deviceKey) {
      try {
        const supersededCount = await cancelSupersededXcloudTests({
          clientId: client.id,
          appId: app.id,
          newTestId: test.id,
          deviceKey,
        })
        if (supersededCount > 0) {
          await writeLog('TEST_SUPERSEDED_PREVIOUS_XCLOUD', 'warning', {
            client_id: client.id,
            test_id: test.id,
            message: `${supersededCount} teste(s) XCloud anterior(es) substituido(s) para o mesmo cliente/app.`,
            metadata: { superseded_count: supersededCount, device_key: maskDeviceKey(deviceKey), operator_ref: operatorRef },
          })
        }
      } catch (supersedeError) {
        await writeLog('TEST_SUPERSEDE_PREVIOUS_XCLOUD_FAILED', 'warning', {
          client_id: client.id,
          test_id: test.id,
          message: supersedeError instanceof Error ? supersedeError.message : 'Falha ao substituir testes XCloud anteriores.',
          metadata: { device_key: maskDeviceKey(deviceKey), operator_ref: operatorRef },
        }).catch(() => undefined)
      }
    }

    let xcloudWorker: Awaited<ReturnType<typeof runXcloudWorker>> | null = null
    if (app.key === 'xcloud' && deviceKey && xcloudWorkerEnabled()) {
      try {
        xcloudWorker = await runXcloudWorker({ test_id: test.id, operator_ref: operatorRef || 'painel_web_wizard' })
        await assertTestStillCurrent(test.id)
        if (xcloudWorker.status === 'failed') {
          await markXcloudGenerationFailed({
            testId: test.id,
            clientId: client.id,
            worker: xcloudWorker as unknown as JsonRecord,
          })
          await writeLog('XCLOUD_WORKER_AUTORUN_FAILED', 'error', {
            client_id: client.id,
            test_id: test.id,
            message: xcloudWorker.message || 'Worker XCloud retornou falha.',
            metadata: { app_key: app.key, device_key: maskDeviceKey(deviceKey), operator_ref: operatorRef, xcloud_worker: xcloudWorker as unknown as JsonRecord },
          })
          throw new TestCreateError(502, 'XCLOUD_WORKER_FAILED', `XCloud nao confirmou a ativacao da device: ${xcloudWorker.message || xcloudWorker.stage}`)
        }
      } catch (workerError) {
        await writeLog('XCLOUD_WORKER_AUTORUN_FAILED', 'error', {
          client_id: client.id,
          test_id: test.id,
          message: workerError instanceof Error ? workerError.message : String(workerError),
          metadata: { app_key: app.key, device_key: maskDeviceKey(deviceKey), operator_ref: operatorRef },
        })
        throw workerError
      }
    }
    if (app.key === 'xcloud') {
      await assertTestStillCurrent(test.id)
    }

    await writeLog('TEST_MESSAGE_DISPATCH_STARTED', 'info', {
      client_id: client.id,
      test_id: test.id,
      message: 'Disparo da mensagem de teste iniciado.',
      metadata: { flow: 'test_created', app_key: app.key, operator_ref: operatorRef },
    })

    let dispatch: JsonRecord
    try {
      dispatch = await dispatchTestCreated({
        testId: test.id,
        clientId: client.id,
        clientName,
        phone: phoneRaw,
        appName: app.name,
        panelName: panel.name,
        pedido: providerResult.order_id || null,
        host: providerResult.host || null,
        username: providerResult.username,
        password: providerResult.password,
        providerCode: providerCode || null,
        expiresAt,
        operatorRef,
      })
      await patchTestLegacyMetadata(test.id, { dispatch })
      await writeLog(dispatch.status === 'failed' ? 'TEST_MESSAGE_DISPATCH_FAILED' : 'TEST_MESSAGE_SENT', dispatch.status === 'failed' ? 'warning' : 'success', {
        client_id: client.id,
        test_id: test.id,
        message: dispatch.status === 'failed' ? 'Mensagem de teste nao foi enviada pelo Painel 2.' : 'Mensagem de teste processada pelo Painel 2.',
        metadata: { flow: 'test_created', dispatch, operator_ref: operatorRef },
      })
    } catch (dispatchError) {
      dispatch = {
        status: 'failed',
        ok: false,
        dry_run: false,
        code: 'DISPATCH_EXCEPTION',
        message: dispatchError instanceof Error ? maskSensitiveText(dispatchError.message).slice(0, 300) : 'Falha ao disparar mensagem.',
        idempotency_key: `test_created:${test.id}`,
        updated_at: new Date().toISOString(),
      }
      await patchTestLegacyMetadata(test.id, { dispatch }).catch(() => undefined)
      await writeLog('TEST_MESSAGE_DISPATCH_FAILED', 'warning', {
        client_id: client.id,
        test_id: test.id,
        message: String(dispatch.message || 'Falha ao disparar mensagem.'),
        metadata: { flow: 'test_created', dispatch, operator_ref: operatorRef },
      })
    }

    await writeLog('TEST_MESSAGE_PREPARED', 'success', {
      client_id: client.id,
      test_id: test.id,
      message: dispatch.status === 'failed' ? 'Mensagem preparada para reenvio manual.' : 'Mensagem de teste enviada/preparada.',
      metadata: { flow: 'test_created', app_key: app.key, dispatch_status: dispatch.status, operator_ref: operatorRef },
    })

    return {
      success: true,
      source: testMode === 'real' ? 'supabase' : 'mock',
      mode: testMode,
      client: { id: client.id, name: client.name, phone: phoneRaw, status: client.status },
      app: { id: app.id, key: app.key, name: app.name },
      panel: { id: panel.id, key: panel.key, name: panel.name },
      test: {
        id: test.id,
        test_id: test.id,
        client_id: client.id,
        app_key: app.key,
        panel_key: panel.key,
        status: test.status,
        order_id: providerResult.order_id || null,
        pedido: providerResult.order_id || null,
        host: providerResult.host || null,
        username: providerResult.username,
        password: providerResult.password,
        code: providerCode || null,
        provider_code: providerCode || null,
        dns: providerResult.dns || null,
        expires_at: expiresAt,
        validade: expiresAt,
        duration_minutes: durationMinutes,
        game_mode_enabled: operationalSettings.game_mode_enabled,
        device_key: app.key === 'xcloud' && deviceKey ? maskDeviceKey(deviceKey) : null,
        xcloud_worker_status: app.key === 'xcloud' ? xcloudWorker?.status || (xcloudWorkerEnabled() ? 'running' : 'not_started') : null,
        xcloud_worker: xcloudWorker,
        dispatch,
        mensagem: publicTestMessage({
          clientName,
          appName: app.name,
          host: providerResult.host,
          username: providerResult.username,
          password: providerResult.password,
          providerCode,
          expiresAt,
        }),
      },
      account: null,
      slot: null,
    }
  } catch (error) {
    const err = error instanceof TestCreateError
      ? error
      : new TestCreateError(500, 'TEST_CREATE_FAILED', error instanceof Error ? error.message : String(error))

    try {
      await writeLog(err.code === 'TEST_CREATE_FAILED' ? 'TEST_CREATE_FAILED' : 'YELLOW_BOX_TEST_FAILED', 'error', {
        message: err.message,
        metadata: { code: err.code, phone: phoneRaw ? maskPhone(phoneRaw) : null, device_key: deviceKey ? maskDeviceKey(deviceKey) : null },
      })
      if (err.code !== 'TEST_CREATE_FAILED') {
        await writeLog('TEST_CREATE_FAILED', 'error', { message: err.message, metadata: { code: err.code } })
      }
    } catch {
      // Preserve the original creation error if audit logging fails.
    }
    throw err
  }
}

export function testCreateErrorResponse(error: unknown) {
  const err = error instanceof TestCreateError
    ? error
    : new TestCreateError(500, 'TEST_CREATE_FAILED', error instanceof Error ? error.message : String(error))
  return {
    status: err.status,
    body: {
      success: false,
      code: err.code,
      error: maskSensitiveText(err.message),
    },
  }
}
