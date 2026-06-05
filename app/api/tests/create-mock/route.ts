/**
 * POST /api/tests/create-mock
 *
 * Mock seguro para a fundacao da aba Gerar Teste.
 *
 * Regras:
 * - Nao chama Yellow, Ninety, XCloud, Evolution, WhatsApp ou painel externo.
 * - Nao gera teste real.
 * - Nao cria account nem account_slot: teste nao ocupa tela.
 * - Xtream Code e o formato principal para XCloud; M3U/HLS ficam como metadata tecnica.
 * - Mantem fallback mock se o Supabase staging falhar.
 */

import { NextRequest, NextResponse } from 'next/server'

import { maskDeviceKey, maskPassword, maskSensitiveText, maskUrl, maskUsername } from '@/lib/services/masking'
import { generateTest } from '@/lib/services/test-generation/generate-test'
import type { GenerateTestInput, TestApp, TestProvider } from '@/lib/services/test-generation/types'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type CreateMockBody = {
  nome?: string
  telefone?: string
  servidor?: string
  clientName?: string
  phone?: string
  app?: string
  provider?: string
  deviceKey?: string
  manualText?: string
  xtream_host?: string
  xtream_username?: string
  xtream_password?: string
  provider_code?: string
  optional_m3u_url?: string
  optional_hls_url?: string
}

const APP_ALIASES: Record<string, TestApp> = {
  xcloud: 'xcloud',
  blessed: 'blessed',
  blessed_player: 'blessed',
  playsim: 'playsim',
  play_sim: 'playsim',
  funplay: 'funplay',
  fun_play: 'funplay',
  smartstb: 'smartstb',
  smart_stb: 'smartstb',
  manual: 'manual',
}

const PROVIDER_ALIASES: Record<string, TestProvider> = {
  yellow: 'yellowbox',
  yellowbox: 'yellowbox',
  yellow_box: 'yellowbox',
  brasil_yellow: 'yellowbox',
  ninety: 'ninety',
  manual: 'manual',
}

const APP_TABLE_KEYS: Record<TestApp, string> = {
  xcloud: 'xcloud',
  blessed: 'blessed',
  playsim: 'playsim',
  funplay: 'funplay',
  smartstb: 'smartstb',
  manual: 'manual',
}

const PANEL_TABLE_KEYS: Record<TestProvider, string> = {
  yellowbox: 'brasil_yellow',
  ninety: 'ninety',
  manual: 'manual',
}

function normalizeKey(value: string | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeApp(value: string | undefined): TestApp {
  return APP_ALIASES[normalizeKey(value)] || 'xcloud'
}

function normalizeProvider(value: string | undefined): TestProvider {
  return PROVIDER_ALIASES[normalizeKey(value)] || 'yellowbox'
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

function publicResponse(result: Awaited<ReturnType<typeof generateTest>>) {
  return {
    ...result,
    xtream_username: result.xtream_username ? maskUsername(result.xtream_username) : undefined,
    xtream_password: result.xtream_password ? maskPassword(result.xtream_password) : undefined,
    optional_m3u_url: result.optional_m3u_url ? maskUrl(result.optional_m3u_url) : undefined,
    optional_hls_url: result.optional_hls_url ? maskUrl(result.optional_hls_url) : undefined,
    messageText: maskSensitiveText(result.messageText),
    legacy_metadata: {
      ...result.legacy_metadata,
      technical_connection: result.legacy_metadata.technical_connection,
    },
  }
}

export async function POST(req: NextRequest) {
  let body: CreateMockBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Payload inválido.' }, { status: 400 })
  }

  const clientName = String(body.clientName || body.nome || '').trim()
  const phone = String(body.phone || body.telefone || '').trim()
  const app = normalizeApp(body.app)
  const provider = normalizeProvider(body.provider || body.servidor)

  if (!clientName || !phone) {
    return NextResponse.json(
      { success: false, error: 'Campos obrigatórios: clientName/nome e phone/telefone.' },
      { status: 400 },
    )
  }

  const input: GenerateTestInput = {
    clientName,
    phone,
    app,
    provider: app === 'manual' ? 'manual' : provider,
    deviceKey: body.deviceKey,
    manualText: body.manualText,
    connection: {
      xtream_host: body.xtream_host,
      xtream_username: body.xtream_username,
      xtream_password: body.xtream_password,
      provider_code: body.provider_code,
      optional_m3u_url: body.optional_m3u_url,
      optional_hls_url: body.optional_hls_url,
    },
  }

  const generated = await generateTest(input)
  const supabase = getSupabaseServerClient()
  let source: 'supabase' | 'mock' = 'mock'
  let appId: string | null = null
  let panelId: string | null = null

  if (supabase) {
    try {
      const [appsRes, panelsRes] = await Promise.allSettled([
        supabase.from('apps').select('id').eq('key', APP_TABLE_KEYS[app]).maybeSingle(),
        supabase.from('panels').select('id').eq('key', PANEL_TABLE_KEYS[input.provider]).maybeSingle(),
      ])

      if (appsRes.status === 'fulfilled' && appsRes.value.data) {
        appId = (appsRes.value.data as { id: string }).id
      }
      if (panelsRes.status === 'fulfilled' && panelsRes.value.data) {
        panelId = (panelsRes.value.data as { id: string }).id
      }

      const now = new Date().toISOString()
      const phoneE164 = normalizePhone(phone)

      const { error: clientErr } = await supabase.from('clients').insert({
        id: generated.clientId,
        name: clientName,
        phone_e164: phoneE164,
        phone_raw: phone,
        status: 'test_active',
        source: 'wizard_mock',
        legacy_metadata: {
          app,
          provider: input.provider,
          app_id: appId,
          panel_id: panelId,
          test_does_not_consume_slot: true,
          no_external_call: true,
        },
        created_at: now,
        updated_at: now,
      })

      if (clientErr) throw new Error(`clients: ${clientErr.message}`)

      const { error: testErr } = await supabase.from('tests').insert({
        id: generated.testId,
        client_id: generated.clientId,
        app_id: appId,
        panel_id: panelId,
        account_id: null,
        device_type: app === 'xcloud' ? 'xcloud_device' : 'any',
        device_key: body.deviceKey || null,
        provider: input.provider,
        provider_code: generated.provider_code || null,
        status: 'active',
        source: 'wizard_mock',
        requested_at: now,
        activated_at: now,
        expires_at: generated.expires_at,
        legacy_metadata: {
          ...generated.legacy_metadata,
          app,
          provider: input.provider,
          connection_type: generated.connection_type,
          xtream_host: generated.xtream_host || null,
          xtream_username: generated.xtream_username || null,
          xtream_password: generated.xtream_password || null,
          provider_code: generated.provider_code || null,
          optional_m3u_url: generated.optional_m3u_url || null,
          optional_hls_url: generated.optional_hls_url || null,
          test_does_not_consume_slot: true,
        },
        created_at: now,
        updated_at: now,
      })

      if (testErr) throw new Error(`tests: ${testErr.message}`)

      const { error: pipeErr } = await supabase.from('pipeline_events').insert({
        id: crypto.randomUUID(),
        entity_type: 'test',
        entity_id: generated.testId,
        event_type: 'mock_test_generated',
        from_status: null,
        to_status: 'active',
        payload: {
          client_id: generated.clientId,
          app_id: appId,
          panel_id: panelId,
          provider: input.provider,
          source: 'wizard_mock',
          test_does_not_consume_slot: true,
        },
      })

      if (pipeErr) throw new Error(`pipeline_events: ${pipeErr.message}`)

      const { error: logErr } = await supabase.from('logs').insert({
        id: crypto.randomUUID(),
        scope: 'wizard',
        level: 'info',
        event: 'test.created.mock',
        client_id: generated.clientId,
        test_id: generated.testId,
        account_id: null,
        message: `Teste mock criado para ${clientName} | app=${app} provider=${input.provider}`,
        metadata: {
          provider_code: generated.provider_code || null,
          expires_at: generated.expires_at,
          source: 'wizard_mock',
          test_does_not_consume_slot: true,
        },
      })

      if (logErr) throw new Error(`logs: ${logErr.message}`)

      source = 'supabase'
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[api/tests/create-mock] Falha no Supabase, usando mock:', maskSensitiveText(msg))
    }
  }

  const response = publicResponse(generated)

  return NextResponse.json({
    success: true,
    source,
    client: {
      id: generated.clientId,
      name: clientName,
      status: 'test_active',
    },
    test: {
      id: generated.testId,
      app,
      provider: input.provider,
      connection_type: generated.connection_type,
      code: generated.provider_code,
      username: generated.xtream_username ? maskUsername(generated.xtream_username) : undefined,
      password: generated.xtream_password ? maskPassword(generated.xtream_password) : undefined,
      device_key: body.deviceKey ? maskDeviceKey(body.deviceKey) : undefined,
      expires_at: generated.expires_at,
      status: 'active',
      mensagem: response.messageText,
    },
    generation: response,
    account: null,
    slot: null,
  })
}
