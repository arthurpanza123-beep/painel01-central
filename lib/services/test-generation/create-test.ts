import { maskDeviceKey, maskPassword, maskPhone, maskSensitiveText, maskUrl, maskUsername } from '@/lib/services/masking'
import { getSupabaseServerClient } from '@/lib/supabase/server'

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

  try {
    if (!clientName || !phoneRaw || !phoneE164) {
      throw new TestCreateError(400, 'VALIDATION_FAILED', 'Campos obrigatorios: client_name e phone.')
    }

    await writeLog('TEST_CREATE_STARTED', 'info', {
      message: `Inicio da geracao de teste para ${clientName}.`,
      metadata: { phone: maskPhone(phoneRaw), mode: testMode },
    })

    const app = await resolveApp(input.app_id, input.app_key || input.app)
    const panel = await resolvePanel(input.panel_id, input.panel_key || input.provider || input.servidor)

    if (!panel.supported_app_keys?.includes(app.key)) {
      throw new TestCreateError(400, 'APP_PANEL_INCOMPATIBLE', 'App e painel nao sao compativeis.')
    }
    if (app.key === 'xcloud' && !deviceKey) {
      throw new TestCreateError(400, 'DEVICE_KEY_REQUIRED', 'device_key e obrigatoria para XCloud.')
    }

    await writeLog('TEST_PROVIDER_SELECTED', 'info', {
      message: `Provider selecionado: ${panel.name}.`,
      metadata: { app_key: app.key, panel_key: panel.key, provider: providerName(panel.key) },
    })
    await writeLog('YELLOW_BOX_TEST_START', 'info', {
      message: `Iniciando teste Yellow Box para app=${app.key}.`,
      metadata: { app_key: app.key, phone: maskPhone(phoneRaw), device_key: deviceKey ? maskDeviceKey(deviceKey) : null },
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
      },
    })

    const database = db()
    const now = new Date().toISOString()
    const existing = await database
      .from('clients')
      .select('id,status,legacy_metadata')
      .eq('phone_e164', phoneE164)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing.error) throw new TestCreateError(500, 'CLIENT_LOOKUP_FAILED', existing.error.message)

    const clientPayload = {
      name: clientName,
      phone_e164: phoneE164,
      phone_raw: phoneRaw,
      status: 'test_active',
      source: testMode === 'real' ? 'test_generation_real' : 'test_generation_mock',
      legacy_metadata: {
        ...((existing.data as { legacy_metadata?: JsonRecord } | null)?.legacy_metadata || {}),
        app_key: app.key,
        panel_key: panel.key,
        latest_test_started_at: startedAt,
        test_does_not_consume_slot: true,
      },
      updated_at: now,
    }

    const clientResult = existing.data
      ? await database.from('clients').update(clientPayload).eq('id', (existing.data as { id: string }).id).select('id,name,status').single()
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
      expires_at: providerResult.expires_at,
      legacy_metadata: {
        order_id: providerResult.order_id || null,
        host: providerResult.host || null,
        dns: providerResult.dns || null,
        username: providerResult.username,
        password: providerResult.password,
        provider_code: providerCode || null,
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
        test_does_not_consume_slot: true,
      },
    })

    await writeLog('TEST_CREATED', 'success', {
      client_id: client.id,
      test_id: test.id,
      message: `Teste criado para ${clientName} | app=${app.key} panel=${panel.key}.`,
      metadata: { order_id: providerResult.order_id || null, expires_at: providerResult.expires_at },
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
        expires_at: providerResult.expires_at,
        validade: providerResult.expires_at,
        device_key: app.key === 'xcloud' && deviceKey ? maskDeviceKey(deviceKey) : null,
        xcloud_worker_status: app.key === 'xcloud' ? 'not_started' : null,
        mensagem: publicTestMessage({
          clientName,
          appName: app.name,
          host: providerResult.host,
          username: providerResult.username,
          password: providerResult.password,
          providerCode,
          expiresAt: providerResult.expires_at,
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
