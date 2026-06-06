import { NextRequest, NextResponse } from 'next/server'

import { getProviderPanelUrl } from '@/lib/config/provider-catalog'
import { maskSensitiveText } from '@/lib/services/masking'
import { effectiveTestExpiresAt, readOperationalSettings } from '@/lib/services/operational-settings'
import {
  getOperationalExpirationState,
  getXcloudRemovalState,
  isCustomerExpiredStickerSatisfied,
  metadataString,
  safeMetadata,
} from '@/lib/services/test-expiration-operational'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { runXcloudWorker } from '@/lib/services/xcloud-worker'

type JsonRecord = Record<string, unknown>

const expiringTests = new Set<string>()

function panelUrl(keyOrName: string | null | undefined) {
  return getProviderPanelUrl(String(keyOrName || '')) || getProviderPanelUrl('Yellow Box') || 'https://pedidospec.online/#/customers'
}

function isOperatorNoticeSent(metadata: JsonRecord): boolean {
  return Boolean(metadataString(metadata, 'operator_expired_notice_sent_at')) || metadataString(metadata, 'operator_expired_notice_status') === 'sent'
}

function painel1BaseUrl() {
  return String(process.env.NEXT_PUBLIC_PAINEL1_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://painel.centralplayplus.com.br').replace(/\/+$/, '')
}

function buildPanelTestLink(testId: string, clientId: string | null) {
  const url = new URL(painel1BaseUrl())
  url.searchParams.set('section', 'tests')
  url.searchParams.set('test_id', testId)
  if (clientId) url.searchParams.set('client_id', clientId)
  return url.toString()
}

function formatDateTimeBR(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
}

function isFreshRunning(metadata: JsonRecord): boolean {
  if (metadataString(metadata, 'expired_dispatch_status') !== 'running') return false
  const startedAt = metadataString(metadata, 'expired_dispatch_running_at') || metadataString(metadata, 'expired_operator_action_at')
  const startedMs = startedAt ? new Date(startedAt).getTime() : NaN
  return Number.isFinite(startedMs) && Date.now() - startedMs < 10 * 60 * 1000
}

async function readLatestTestMetadata(db: NonNullable<ReturnType<typeof getSupabaseServerClient>>, testId: string): Promise<JsonRecord> {
  const { data } = await db.from('tests').select('legacy_metadata').eq('id', testId).maybeSingle()
  return safeMetadata((data as { legacy_metadata?: JsonRecord | null } | null)?.legacy_metadata)
}

function xcloudResponseFromState(state: ReturnType<typeof getXcloudRemovalState>) {
  if (state.notRequired) return { ok: true, not_required: true, status: 'not_required' }
  if (state.alreadyRemoved) return { ok: true, already_removed: true, status: 'already_removed' }
  if (state.removed || state.satisfied) return { ok: true, removed: true, status: 'removed' }
  return { ok: false, status: state.status }
}

async function dispatchOperatorExpiredNotice(db: NonNullable<ReturnType<typeof getSupabaseServerClient>>, input: {
  test: {
    id: string
    client_id: string | null
    account_id: string | null
  }
  metadata: JsonRecord
  client: { name?: string | null; phone_e164?: string | null } | null
  app: { name?: string | null; key?: string | null } | null
  panel: { name?: string | null; key?: string | null } | null
  username: string
  expiredAt: string
  operatorRef: string
  source: 'manual' | 'auto'
}) {
  const operatorIdempotencyKey = `operator_test_expired:${input.test.id}`
  if (isOperatorNoticeSent(input.metadata)) {
    return { ok: true, already_sent: true, idempotency_key: operatorIdempotencyKey }
  }

  const link = buildPanelTestLink(input.test.id, input.test.client_id)
  const response = await fetch(`${painel2BaseUrl()}/api/flows/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flow: 'operator_test_expired',
      idempotency_key: operatorIdempotencyKey,
      client: { name: input.client?.name || '', phone: input.client?.phone_e164 || '' },
      test: {
        id: input.test.id,
        client_id: input.test.client_id || '',
        app: input.app?.name || input.app?.key || '',
        panel: input.panel?.name || input.panel?.key || '',
        username: input.username,
        expired_at: formatDateTimeBR(input.expiredAt),
        link,
      },
      context: {
        source: input.source === 'auto' ? 'painel1_expire_due' : 'painel1',
        operator_ref: input.operatorRef,
        test_id: input.test.id,
        client_id: input.test.client_id || '',
        clientPhone: input.client?.phone_e164 || '',
        expiredAt: formatDateTimeBR(input.expiredAt),
        link,
        idempotency_key: operatorIdempotencyKey,
      },
    }),
  })
  const result = await response.json().catch(() => ({ ok: false, code: 'INVALID_RESPONSE' })) as {
    ok?: boolean
    dryRun?: boolean
    already_sent?: boolean
    code?: string
    recipients?: string[]
    results?: Array<{ ok?: boolean; dryRun?: boolean; code?: string; phone?: string }>
  }
  const sent = Boolean(result.ok)
  const finishedAt = new Date().toISOString()
  const nextMetadata = {
    ...input.metadata,
    operator_expired_notice_status: sent ? 'sent' : 'failed',
    operator_expired_notice_sent_at: sent ? finishedAt : metadataString(input.metadata, 'operator_expired_notice_sent_at') || undefined,
    operator_expired_notice_failed_at: sent ? undefined : finishedAt,
    operator_expired_notice_code: result.code || null,
    operator_expired_notice_recipients: result.recipients || [],
    operator_expired_notice_idempotency_key: operatorIdempotencyKey,
  }

  await db.from('tests').update({ legacy_metadata: nextMetadata }).eq('id', input.test.id).then(() => null)
  await writeTestLog(db, sent ? 'OPERATOR_TEST_EXPIRED_NOTICE_SENT' : 'OPERATOR_TEST_EXPIRED_NOTICE_FAILED', sent ? 'success' : 'error', {
    client_id: input.test.client_id,
    test_id: input.test.id,
    account_id: input.test.account_id,
    message: sent ? 'Aviso operacional de teste expirado processado pelo Painel 2.' : 'Falha ao enviar aviso operacional de teste expirado.',
    metadata: {
      dryRun: result.dryRun,
      already_sent: result.already_sent,
      code: result.code,
      recipients: result.recipients || [],
      idempotency_key: operatorIdempotencyKey,
      link,
    },
  })

  return { ...result, idempotency_key: operatorIdempotencyKey, link }
}

async function writeTestLog(db: NonNullable<ReturnType<typeof getSupabaseServerClient>>, event: string, level: 'info' | 'warning' | 'error' | 'success', payload: {
  client_id?: string | null
  test_id?: string | null
  account_id?: string | null
  message: string
  metadata?: JsonRecord
}) {
  const line = `[${event}] ${maskSensitiveText(payload.message)} ${JSON.stringify(payload.metadata || {})}`
  if (level === 'error') console.error(line)
  else if (level === 'warning') console.warn(line)
  else console.log(line)

  await db.from('logs').insert({
    scope: 'tests',
    level,
    event,
    client_id: payload.client_id || null,
    test_id: payload.test_id || null,
    account_id: payload.account_id || null,
    message: maskSensitiveText(payload.message),
    metadata: payload.metadata || {},
  }).then(() => null)
}

function painel2BaseUrl() {
  return String(process.env.PAINEL2_INTERNAL_URL || process.env.NEXT_PUBLIC_PAINEL2_URL || 'http://127.0.0.1:3002').replace(/\/+$/, '')
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { test_id?: string; confirm_expire?: boolean; operator_ref?: string; source?: 'manual' | 'auto' } | null
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
    .select('id,client_id,account_id,panel_id,app_id,status,device_key,activated_at,created_at,expires_at,legacy_metadata')
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
    device_key: string | null
    activated_at: string | null
    created_at: string | null
    expires_at: string | null
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
  const idempotencyKey = `test_expired:${test.id}`
  const operatorRef = body.operator_ref || (body.source === 'auto' ? 'painel_web_expire_due' : 'painel_web')
  const operationalSettings = await readOperationalSettings()
  const expiredAt = effectiveTestExpiresAt({
    activated_at: test.activated_at,
    requested_at: null,
    created_at: test.created_at,
    expires_at: test.expires_at,
    legacy_metadata: metadata,
  }, operationalSettings).expiresAt

  await writeTestLog(db, 'TEST_EXPIRE_REQUESTED', 'info', {
    client_id: test.client_id,
    test_id: test.id,
    account_id: test.account_id,
    message: 'Expiracao manual solicitada pelo Painel 1.',
    metadata: {
      previous_status: previousStatus,
      app: app?.name || app?.key || null,
      panel: panel?.name || panel?.key || null,
      operator_ref: operatorRef,
    },
  })

  await writeTestLog(db, 'TEST_EXPIRE_PANEL_OPEN_CONTEXT', 'info', {
    client_id: test.client_id,
    test_id: test.id,
    account_id: test.account_id,
    message: 'Contexto de abertura do painel do provedor calculado.',
    metadata: {
      provider_url: providerUrl,
      panel: panel?.name || panel?.key || null,
      username_present: Boolean(username),
    },
  })

  const initialOperationalState = getOperationalExpirationState({
    status: previousStatus,
    appKey: app?.key,
    appName: app?.name,
    deviceKey: test.device_key,
    metadata,
  })

  if (previousStatus === 'expired' && initialOperationalState.complete) {
    await writeTestLog(db, 'TEST_EXPIRE_SKIPPED_OPERATIONAL_ALREADY_COMPLETE', 'info', {
      client_id: test.client_id,
      test_id: test.id,
      account_id: test.account_id,
      message: 'Teste ja expirado com expiração operacional concluida. Nada sera repetido.',
      metadata: {
        idempotency_key: idempotencyKey,
        customer_expired_sticker_status: metadataString(metadata, 'customer_expired_sticker_status') || metadataString(metadata, 'expired_dispatch_status') || null,
        xcloud_device_remove_status: metadataString(metadata, 'xcloud_device_remove_status') || metadataString(metadata, 'expired_xcloud_remove_status') || null,
        operator_expire_action_completed_at: metadataString(metadata, 'operator_expire_action_completed_at') || null,
      },
    })

    const xcloudState = xcloudResponseFromState(initialOperationalState.xcloud)
    return NextResponse.json({
      ok: true,
      success: true,
      code: 'TEST_ALREADY_EXPIRED',
      already_expired: true,
      status: 'expired',
      sticker_sent: true,
      already_sent: true,
      sticker_already_sent: true,
      test_id: test.id,
      client_id: test.client_id,
      app: app?.name || app?.key || null,
      panel: panel?.name || panel?.key || null,
      username,
      provider_url: providerUrl,
      operational_completed: true,
      dispatch: { ok: true, already_sent: true, idempotency_key: idempotencyKey },
      operator_notice: { skipped: true, reason: 'already_expired_operational_complete' },
      xcloud_remove: xcloudState,
      xcloud_removed: Boolean(initialOperationalState.xcloud.removed),
      already_removed: Boolean(initialOperationalState.xcloud.alreadyRemoved),
      not_required: Boolean(initialOperationalState.xcloud.notRequired),
    })
  }

  if (expiringTests.has(test.id) || isFreshRunning(metadata)) {
    await writeTestLog(db, 'TEST_EXPIRE_ALREADY_RUNNING', 'warning', {
      client_id: test.client_id,
      test_id: test.id,
      account_id: test.account_id,
      message: 'Expiracao ja esta em processamento. Chamada duplicada ignorada.',
      metadata: { idempotency_key: idempotencyKey },
    })

    return NextResponse.json({
      ok: true,
      success: true,
      code: 'TEST_EXPIRE_ALREADY_RUNNING',
      already_running: true,
      test_id: test.id,
      client_id: test.client_id,
      username,
      provider_url: providerUrl,
      dispatch: { ok: true, already_sent: false, skipped: true, reason: 'already_running', idempotency_key: idempotencyKey },
      xcloud_remove: { skipped: true, reason: 'already_running' },
    })
  }

  expiringTests.add(test.id)

  try {
	    const now = new Date().toISOString()
	    const stickerAlreadySatisfied = isCustomerExpiredStickerSatisfied(metadata)
	    let operationalMetadata: JsonRecord = {
	      ...metadata,
	      expired_dispatch_status: stickerAlreadySatisfied ? metadataString(metadata, 'expired_dispatch_status') || 'sent' : 'running',
	      expired_dispatch_running_at: stickerAlreadySatisfied ? metadataString(metadata, 'expired_dispatch_running_at') || undefined : now,
	      expired_dispatch_idempotency_key: idempotencyKey,
	      customer_expired_sticker_idempotency_key: idempotencyKey,
	      expired_operator_action_at: now,
	      provider_panel_opened_at: metadataString(metadata, 'provider_panel_opened_at') || now,
	      copied_username_at: username ? metadataString(metadata, 'copied_username_at') || now : metadataString(metadata, 'copied_username_at') || undefined,
	      manual_expire: {
	        expired_at: now,
	        operator_ref: operatorRef,
        previous_status: previousStatus,
      },
    }

    let claimed = previousStatus !== 'expired'
    if (previousStatus !== 'expired') {
      let updateQuery = db
        .from('tests')
        .update({
          status: 'expired',
          failed_at: now,
          legacy_metadata: operationalMetadata,
        })
        .eq('id', test.id)
        .select('id')

      updateQuery = previousStatus === null ? updateQuery.is('status', null) : updateQuery.eq('status', previousStatus)
      const { data: updatedRows, error: updateError } = await updateQuery

      if (updateError) throw new Error(updateError.message)
      claimed = Array.isArray(updatedRows) && updatedRows.length === 1
    } else {
      const { error: updateError } = await db
        .from('tests')
        .update({ legacy_metadata: operationalMetadata })
        .eq('id', test.id)

      if (updateError) throw new Error(updateError.message)
    }

    if (!claimed) {
      await writeTestLog(db, 'TEST_EXPIRE_ALREADY_RUNNING', 'warning', {
        client_id: test.client_id,
        test_id: test.id,
        account_id: test.account_id,
        message: 'Outra chamada marcou o teste como expired antes desta requisicao.',
        metadata: { previous_status: previousStatus, idempotency_key: idempotencyKey },
      })

      return NextResponse.json({
        ok: true,
        success: true,
        code: 'TEST_EXPIRE_ALREADY_RUNNING',
        already_running: true,
        test_id: test.id,
        client_id: test.client_id,
        username,
        provider_url: providerUrl,
        dispatch: { ok: true, skipped: true, reason: 'concurrent_claim_lost', idempotency_key: idempotencyKey },
        xcloud_remove: { skipped: true, reason: 'concurrent_claim_lost' },
      })
    }

    await writeTestLog(db, 'TEST_EXPIRED', 'warning', {
      client_id: test.client_id,
      test_id: test.id,
      account_id: test.account_id,
      message: 'Teste expirado manualmente pelo operador.',
      metadata: {
        previous_status: previousStatus,
        app: app?.name || app?.key || null,
        panel: panel?.name || panel?.key || null,
      },
    })

    let xcloudRemove: unknown = null
    let xcloudState = getXcloudRemovalState({
      appKey: app?.key,
      appName: app?.name,
      deviceKey: test.device_key,
      metadata: operationalMetadata,
    })

    if (!xcloudState.required) {
      operationalMetadata = {
        ...operationalMetadata,
        xcloud_device_remove_status: 'not_required',
      }
      xcloudRemove = { ok: true, not_required: true, status: 'not_required' }
      await db.from('tests').update({ legacy_metadata: operationalMetadata }).eq('id', test.id).then(() => null)
    } else if (body.source === 'auto') {
      xcloudRemove = { skipped: true, reason: 'auto_expire_requires_operator_confirmation' }
      await writeTestLog(db, 'XCLOUD_REMOVE_SKIPPED_AUTO_EXPIRE', 'info', {
        client_id: test.client_id,
        test_id: test.id,
        account_id: test.account_id,
        message: 'Expiracao automatica nao remove device XCloud sem confirmacao do operador.',
        metadata: { source: 'expire_due' },
      })
    } else if (xcloudState.satisfied) {
      const xcloudFinishedAt = metadataString(operationalMetadata, 'xcloud_device_removed_at') || metadataString(operationalMetadata, 'expired_xcloud_remove_finished_at') || new Date().toISOString()
      operationalMetadata = {
        ...operationalMetadata,
        xcloud_device_removed_at: xcloudFinishedAt,
        xcloud_device_remove_status: xcloudState.alreadyRemoved ? 'already_removed' : 'removed',
        expired_xcloud_remove_finished_at: metadataString(operationalMetadata, 'expired_xcloud_remove_finished_at') || xcloudFinishedAt,
        expired_xcloud_remove_status: metadataString(operationalMetadata, 'expired_xcloud_remove_status') || 'done',
      }
      xcloudRemove = xcloudResponseFromState(xcloudState)
      await db.from('tests').update({ legacy_metadata: operationalMetadata }).eq('id', test.id).then(() => null)
    } else {
      const xcloudAttemptedAt = new Date().toISOString()
      operationalMetadata = {
        ...operationalMetadata,
        expired_xcloud_remove_attempted_at: xcloudAttemptedAt,
        xcloud_device_remove_status: 'running',
      }
      await db.from('tests').update({ legacy_metadata: operationalMetadata }).eq('id', test.id).then(() => null)
      await writeTestLog(db, 'XCLOUD_DEVICE_REMOVAL_STARTED', 'info', {
        client_id: test.client_id,
        test_id: test.id,
        account_id: test.account_id,
        message: 'Remocao manual da device XCloud iniciada na expiracao.',
        metadata: { source: 'manual_expire' },
      })
      try {
        xcloudRemove = await runXcloudWorker({
          test_id: test.id,
          mode: 'remove_device',
          confirm_remove: true,
          operator_ref: operatorRef,
        })
      } catch (error) {
        xcloudRemove = { success: false, error: error instanceof Error ? error.message : String(error) }
        await writeTestLog(db, 'XCLOUD_REMOVE_FAILED', 'error', {
          client_id: test.client_id,
          test_id: test.id,
          account_id: test.account_id,
          message: error instanceof Error ? error.message : 'Falha ao remover device XCloud na expiracao.',
          metadata: { source: 'test_expire' },
        })
      }

      const xcloudResult = xcloudRemove as { status?: string; success?: boolean; device_removed?: boolean; device_found?: boolean } | null
      const xcloudRemoved = xcloudResult?.device_removed === true
      const xcloudAlreadyRemoved = xcloudRemoved && xcloudResult?.device_found === false
      const xcloudFinishedAt = new Date().toISOString()
      operationalMetadata = {
        ...operationalMetadata,
        expired_xcloud_remove_finished_at: xcloudFinishedAt,
        expired_xcloud_remove_status: xcloudRemoved ? 'done' : 'failed',
        xcloud_device_removed_at: xcloudRemoved ? xcloudFinishedAt : metadataString(operationalMetadata, 'xcloud_device_removed_at') || undefined,
        xcloud_device_remove_status: xcloudRemoved ? xcloudAlreadyRemoved ? 'already_removed' : 'removed' : 'failed',
        xcloud_device_remove_failed_at: xcloudRemoved ? undefined : xcloudFinishedAt,
      }
      await db.from('tests').update({ legacy_metadata: operationalMetadata }).eq('id', test.id).then(() => null)
      await writeTestLog(db, 'XCLOUD_DEVICE_REMOVAL_COMPLETED', xcloudRemoved ? 'success' : 'warning', {
        client_id: test.client_id,
        test_id: test.id,
        account_id: test.account_id,
        message: xcloudRemoved ? 'Remocao manual da device XCloud finalizada na expiracao.' : 'Remocao manual da device XCloud nao foi confirmada.',
        metadata: { source: 'manual_expire', result: xcloudRemove as JsonRecord },
      })
    }

    const stickerAlreadySentBeforeDispatch = isCustomerExpiredStickerSatisfied(operationalMetadata)
    await writeTestLog(db, 'TEST_EXPIRED_DISPATCH_STARTED', 'info', {
      client_id: test.client_id,
      test_id: test.id,
      account_id: test.account_id,
      message: body.source === 'auto' ? 'Expiracao automatica: dispatch de cliente ignorado.' : stickerAlreadySentBeforeDispatch ? 'Figurinha test_expired ja registrada; dispatch nao sera duplicado.' : 'Disparo test_expired iniciado em background.',
      metadata: { phone: client?.phone_e164 ? 'present' : 'missing', already_sent: stickerAlreadySentBeforeDispatch, idempotency_key: idempotencyKey },
    })

    let dispatchResult: unknown = null
    let operatorNoticeResult: unknown = null
    if (body.source === 'auto') {
      dispatchResult = { ok: true, skipped: true, reason: 'auto_expire_operator_notice_only', idempotency_key: idempotencyKey }
      operationalMetadata = {
        ...operationalMetadata,
        expired_dispatch_status: metadataString(metadata, 'expired_dispatch_status') || 'skipped_auto',
        expired_dispatch_running_at: undefined,
      }
      await db.from('tests').update({ legacy_metadata: operationalMetadata }).eq('id', test.id).then(() => null)
    } else if (stickerAlreadySentBeforeDispatch) {
      const finishedAt = metadataString(operationalMetadata, 'customer_expired_sticker_sent_at') || metadataString(operationalMetadata, 'expired_dispatch_sent_at') || new Date().toISOString()
      dispatchResult = { ok: true, already_sent: true, skipped: true, reason: 'already_sent', idempotency_key: idempotencyKey }
      operationalMetadata = {
        ...operationalMetadata,
        expired_dispatch_status: metadataString(operationalMetadata, 'expired_dispatch_status') || 'sent',
        expired_dispatch_sent_at: metadataString(operationalMetadata, 'expired_dispatch_sent_at') || finishedAt,
        expired_dispatch_running_at: undefined,
	        customer_expired_sticker_status: metadataString(operationalMetadata, 'customer_expired_sticker_status') || 'already_sent',
	        customer_expired_sticker_sent_at: metadataString(operationalMetadata, 'customer_expired_sticker_sent_at') || finishedAt,
	        customer_expired_sticker_idempotency_key: idempotencyKey,
	      }
      await db.from('tests').update({ legacy_metadata: operationalMetadata }).eq('id', test.id).then(() => null)
      await writeTestLog(db, 'TEST_EXPIRED_STICKER_SKIPPED_ALREADY_SENT', 'info', {
        client_id: test.client_id,
        test_id: test.id,
        account_id: test.account_id,
        message: 'Figurinha test_expired ja registrada no Painel 1. Nada foi reenviado.',
        metadata: { idempotency_key: idempotencyKey },
      })
    } else try {
      const dispatchResponse = await fetch(`${painel2BaseUrl()}/api/flows/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow: 'test_expired',
          idempotency_key: idempotencyKey,
          phone: client?.phone_e164 || undefined,
          client: { name: client?.name || '', phone: client?.phone_e164 || '' },
          test: {
            id: test.id,
            app: app?.name || app?.key || '',
            panel: panel?.name || panel?.key || '',
            username,
            expires_at: expiredAt,
          },
          context: {
            source: 'painel1',
            operator_ref: operatorRef,
            test_id: test.id,
            client_id: test.client_id || '',
            idempotency_key: idempotencyKey,
          },
        }),
      })
      dispatchResult = await dispatchResponse.json().catch(() => ({ ok: false, code: 'INVALID_RESPONSE' }))
      const resultRecord = dispatchResult as { ok?: boolean; dryRun?: boolean; already_sent?: boolean; code?: string; mediaResult?: { ok?: boolean; code?: string } }
      const mediaFailed = resultRecord.mediaResult && resultRecord.mediaResult.ok === false
      const sent = Boolean(resultRecord.already_sent || (resultRecord.ok && !mediaFailed))
      await writeTestLog(db, resultRecord.already_sent ? 'TEST_EXPIRED_STICKER_SKIPPED_ALREADY_SENT' : sent ? 'TEST_EXPIRED_STICKER_SENT' : 'TEST_EXPIRED_STICKER_FAILED', sent ? 'success' : 'error', {
        client_id: test.client_id,
        test_id: test.id,
        account_id: test.account_id,
        message: resultRecord.already_sent ? 'Painel 2 ignorou dispatch duplicado.' : sent ? 'Flow test_expired processado pelo Painel 2.' : 'Falha no envio test_expired.',
        metadata: {
          ok: resultRecord.ok,
          dryRun: resultRecord.dryRun,
          already_sent: resultRecord.already_sent,
          code: resultRecord.code,
          media_code: resultRecord.mediaResult?.code || null,
          idempotency_key: idempotencyKey,
        },
      })

      const finishedAt = new Date().toISOString()
      const dispatchMetadata = {
        ...operationalMetadata,
        expired_dispatch_status: sent ? 'sent' : 'failed',
        expired_dispatch_sent_at: sent ? metadataString(metadata, 'expired_dispatch_sent_at') || finishedAt : metadataString(metadata, 'expired_dispatch_sent_at') || undefined,
        expired_dispatch_failed_at: sent ? undefined : finishedAt,
        expired_dispatch_running_at: undefined,
        expired_dispatch_code: resultRecord.code || null,
	        customer_expired_sticker_status: resultRecord.already_sent ? 'already_sent' : sent ? 'sent' : 'failed',
	        customer_expired_sticker_sent_at: sent ? metadataString(metadata, 'customer_expired_sticker_sent_at') || metadataString(metadata, 'expired_dispatch_sent_at') || finishedAt : metadataString(metadata, 'customer_expired_sticker_sent_at') || undefined,
	        customer_expired_sticker_failed_at: sent ? undefined : finishedAt,
	        customer_expired_sticker_code: resultRecord.code || null,
	        customer_expired_sticker_idempotency_key: idempotencyKey,
	      }
      await db
        .from('tests')
        .update({
          legacy_metadata: dispatchMetadata,
        })
        .eq('id', test.id)
        .then(() => null)
      operationalMetadata = dispatchMetadata
    } catch (error) {
      dispatchResult = { ok: false, error: error instanceof Error ? error.message : String(error) }
      const failedDispatchMetadata = {
        ...operationalMetadata,
        expired_dispatch_status: 'failed',
        expired_dispatch_failed_at: new Date().toISOString(),
        expired_dispatch_running_at: undefined,
	        customer_expired_sticker_status: 'failed',
	        customer_expired_sticker_failed_at: new Date().toISOString(),
	        customer_expired_sticker_idempotency_key: idempotencyKey,
	      }
      await db
        .from('tests')
        .update({
          legacy_metadata: failedDispatchMetadata,
        })
        .eq('id', test.id)
        .then(() => null)
      operationalMetadata = failedDispatchMetadata
      await writeTestLog(db, 'TEST_EXPIRED_STICKER_FAILED', 'error', {
        client_id: test.client_id,
        test_id: test.id,
        account_id: test.account_id,
        message: error instanceof Error ? error.message : 'Falha ao disparar test_expired.',
        metadata: { source: 'painel1_dispatch', idempotency_key: idempotencyKey },
      })
    }

	    operatorNoticeResult = await dispatchOperatorExpiredNotice(db, {
	      test,
	      metadata: operationalMetadata,
	      client,
      app,
      panel,
      username,
      expiredAt,
      operatorRef,
	      source: body.source === 'auto' ? 'auto' : 'manual',
	    }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }))

	    operationalMetadata = {
	      ...operationalMetadata,
	      ...await readLatestTestMetadata(db, test.id),
	    }
	    const completionCheck = getOperationalExpirationState({
	      status: 'expired',
	      appKey: app?.key,
	      appName: app?.name,
	      deviceKey: test.device_key,
	      metadata: operationalMetadata,
	    })
	    const canCompleteOperationalAction = body.source !== 'auto' && completionCheck.customerStickerSatisfied && completionCheck.xcloudRemovalSatisfied
	    const completionAt = metadataString(operationalMetadata, 'operator_expire_action_completed_at') || new Date().toISOString()

	    operationalMetadata = canCompleteOperationalAction ? {
	      ...operationalMetadata,
	      operator_expire_action_status: 'completed',
	      operator_expire_action_completed_at: completionAt,
	      provider_panel_opened_at: metadataString(operationalMetadata, 'provider_panel_opened_at') || completionAt,
	      copied_username_at: username ? metadataString(operationalMetadata, 'copied_username_at') || completionAt : metadataString(operationalMetadata, 'copied_username_at') || undefined,
	    } : {
	      ...operationalMetadata,
	      operator_expire_action_status: metadataString(operationalMetadata, 'operator_expire_action_status') === 'completed' ? 'completed' : 'pending',
	      operator_expire_action_pending_reason: !completionCheck.customerStickerSatisfied ? 'customer_sticker_pending' : !completionCheck.xcloudRemovalSatisfied ? 'xcloud_remove_pending' : 'auto_expire',
	    }
	    await db.from('tests').update({ legacy_metadata: operationalMetadata }).eq('id', test.id).then(() => null)

	    const finalState = getOperationalExpirationState({
	      status: 'expired',
	      appKey: app?.key,
	      appName: app?.name,
	      deviceKey: test.device_key,
	      metadata: operationalMetadata,
	    })
	    xcloudState = finalState.xcloud
	    const dispatchRecord = dispatchResult as { already_sent?: boolean } | null
	    const customerStickerStatus = metadataString(operationalMetadata, 'customer_expired_sticker_status')
	    const alreadySent = Boolean(dispatchRecord?.already_sent || customerStickerStatus === 'already_sent')
	    const xcloudRemoveResponse = xcloudRemove || xcloudResponseFromState(xcloudState)
	    const pendingReason = finalState.complete ? null : !finalState.customerStickerSatisfied ? 'customer_sticker_pending' : !finalState.xcloudRemovalSatisfied ? 'xcloud_remove_pending' : 'operator_action_pending'

	    return NextResponse.json({
	      ok: true,
	      success: true,
	      code: finalState.complete ? previousStatus === 'expired' ? 'TEST_OPERATIONAL_EXPIRATION_COMPLETED' : 'TEST_EXPIRED' : 'TEST_EXPIRATION_OPERATIONAL_PENDING',
	      status: 'expired',
	      already_expired: previousStatus === 'expired',
	      test_id: test.id,
	      client_id: test.client_id,
	      client_name: client?.name || null,
	      client_phone: client?.phone_e164 || null,
	      app: app?.name || app?.key || null,
	      panel: panel?.name || panel?.key || null,
	      username,
	      provider_url: providerUrl,
	      idempotency_key: idempotencyKey,
	      sticker_sent: finalState.customerStickerSatisfied,
	      already_sent: alreadySent,
	      sticker_already_sent: alreadySent,
	      xcloud_removed: Boolean(xcloudState.removed || xcloudState.alreadyRemoved),
	      already_removed: Boolean(xcloudState.alreadyRemoved),
	      not_required: Boolean(xcloudState.notRequired),
	      operational_completed: finalState.complete,
	      pending_reason: pendingReason,
	      dispatch: dispatchResult,
	      operator_notice: operatorNoticeResult,
	      xcloud_remove: xcloudRemoveResponse,
	    })
	  } catch (error) {
	    const failedAt = new Date().toISOString()
	    const latestMetadata = await readLatestTestMetadata(db, test.id).catch(() => metadata)
	    await db.from('tests').update({
	      legacy_metadata: {
	        ...latestMetadata,
	        expired_dispatch_running_at: undefined,
	        operator_expire_action_status: 'pending',
	        operator_expire_action_pending_reason: 'route_failed',
	        operator_expire_action_failed_at: failedAt,
	      },
	    }).eq('id', test.id).then(() => null)
	    await writeTestLog(db, 'TEST_EXPIRE_FAILED', 'error', {
	      client_id: test.client_id,
	      test_id: test.id,
      account_id: test.account_id,
      message: error instanceof Error ? error.message : 'Falha ao expirar teste.',
      metadata: { idempotency_key: idempotencyKey },
    })
    return NextResponse.json({ ok: false, success: false, code: 'TEST_EXPIRE_FAILED', error: error instanceof Error ? error.message : 'Falha ao expirar teste.' }, { status: 500 })
  } finally {
    expiringTests.delete(test.id)
  }
}
