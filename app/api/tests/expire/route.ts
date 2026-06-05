import { NextRequest, NextResponse } from 'next/server'

import { getProviderPanelUrl } from '@/lib/config/provider-catalog'
import { maskSensitiveText } from '@/lib/services/masking'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type JsonRecord = Record<string, unknown>

function panelUrl(keyOrName: string | null | undefined) {
  return getProviderPanelUrl(String(keyOrName || '')) || getProviderPanelUrl('Yellow Box') || 'https://pedidospec.online/#/customers'
}

function safeMetadata(metadata: JsonRecord | null | undefined): JsonRecord {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { test_id?: string; confirm_expire?: boolean; operator_ref?: string } | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, code: 'INVALID_JSON', error: 'Envie JSON valido.' }, { status: 400 })
  }
  if (!body.test_id) {
    return NextResponse.json({ success: false, code: 'TEST_ID_REQUIRED', error: 'Informe test_id.' }, { status: 400 })
  }
  if (body.confirm_expire !== true) {
    return NextResponse.json({ success: false, code: 'CONFIRM_EXPIRE_REQUIRED', error: 'Expirar teste exige confirm_expire=true.' }, { status: 409 })
  }

  const db = getSupabaseServerClient()
  if (!db) {
    return NextResponse.json({ success: false, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase server env ausente.' }, { status: 500 })
  }

  const { data: testData, error: testError } = await db
    .from('tests')
    .select('id,client_id,account_id,panel_id,app_id,status,legacy_metadata')
    .eq('id', body.test_id)
    .maybeSingle()

  if (testError) return NextResponse.json({ success: false, code: 'TEST_LOOKUP_FAILED', error: testError.message }, { status: 500 })
  if (!testData) return NextResponse.json({ success: false, code: 'TEST_NOT_FOUND', error: 'Teste nao encontrado.' }, { status: 404 })

  const test = testData as {
    id: string
    client_id: string | null
    account_id: string | null
    panel_id: string | null
    app_id: string | null
    status: string | null
    legacy_metadata: JsonRecord | null
  }
  const previousStatus = test.status || null
  const metadata = safeMetadata(test.legacy_metadata)

  const [accountRes, panelRes, appRes, clientRes] = await Promise.all([
    test.account_id ? db.from('accounts').select('username,panel_external_id,provider').eq('id', test.account_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    test.panel_id ? db.from('panels').select('name,key').eq('id', test.panel_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    test.app_id ? db.from('apps').select('name,key').eq('id', test.app_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    test.client_id ? db.from('clients').select('name,phone_e164').eq('id', test.client_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])

  for (const result of [accountRes, panelRes, appRes, clientRes]) {
    if (result.error) {
      return NextResponse.json({ success: false, code: 'RELATED_LOOKUP_FAILED', error: result.error.message }, { status: 500 })
    }
  }

  const account = accountRes.data as { username?: string | null; provider?: string | null } | null
  const panel = panelRes.data as { name?: string | null; key?: string | null } | null
  const app = appRes.data as { name?: string | null; key?: string | null } | null
  const client = clientRes.data as { name?: string | null; phone_e164?: string | null } | null
  const username = String(account?.username || metadata.username || metadata.xtream_username || '').trim()
  const providerUrl = panelUrl(panel?.key || panel?.name || account?.provider || '')

  const { error: updateError } = await db
    .from('tests')
    .update({
      status: 'expired',
      failed_at: new Date().toISOString(),
      legacy_metadata: {
        ...metadata,
        manual_expire: {
          expired_at: new Date().toISOString(),
          operator_ref: body.operator_ref || 'painel_web',
          previous_status: previousStatus,
        },
      },
    })
    .eq('id', test.id)

  if (updateError) return NextResponse.json({ success: false, code: 'TEST_EXPIRE_FAILED', error: updateError.message }, { status: 500 })

  await db.from('logs').insert({
    scope: 'tests',
    level: 'warning',
    event: 'TEST_MANUALLY_EXPIRED',
    client_id: test.client_id,
    test_id: test.id,
    account_id: test.account_id,
    message: maskSensitiveText('Teste expirado manualmente pelo operador.'),
    metadata: {
      previous_status: previousStatus,
      app: app?.name || app?.key || null,
      panel: panel?.name || panel?.key || null,
    },
  }).then(() => null)

  return NextResponse.json({
    success: true,
    code: 'TEST_EXPIRED',
    test_id: test.id,
    client_id: test.client_id,
    client_name: client?.name || null,
    client_phone: client?.phone_e164 || null,
    app: app?.name || app?.key || null,
    panel: panel?.name || panel?.key || null,
    username,
    provider_url: providerUrl,
    painel2_url: `https://painel2.centralplayplus.com.br?${new URLSearchParams({
      source: 'painel1',
      flow: 'test_expired',
      test_id: test.id,
      ...(test.client_id ? { client_id: test.client_id } : {}),
      ...(client?.name ? { client_name: client.name } : {}),
      ...(client?.phone_e164 ? { client_phone: client.phone_e164 } : {}),
      ...(app?.name || app?.key ? { app: String(app?.name || app?.key) } : {}),
      ...(panel?.name || panel?.key ? { panel: String(panel?.name || panel?.key) } : {}),
    }).toString()}`,
  })
}
