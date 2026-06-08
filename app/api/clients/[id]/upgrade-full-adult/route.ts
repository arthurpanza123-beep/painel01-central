import { NextRequest, NextResponse } from 'next/server'

import { createFullAdultAccess, fullAdultApiMissingMessage, fullAdultPanelKey } from '@/lib/services/full-adult-provider'
import { maskSensitiveText } from '@/lib/services/masking'
import { packageMetadata } from '@/lib/services/package-options'
import { findAccountForClient, isOccupiedSlot, type AccountSharingSlot } from '@/lib/services/account-sharing'
import { runXcloudWorker } from '@/lib/services/xcloud-worker'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type JsonRecord = Record<string, unknown>
type RouteContext = { params: Promise<{ id: string }> }

type ClientRow = {
  id: string
  name: string | null
  phone_e164: string | null
  phone_raw: string | null
  status: string | null
  legacy_metadata: JsonRecord | null
}

type AccountRow = {
  id: string
  client_id: string | null
  app_id: string | null
  panel_id: string | null
  username: string | null
  password_secret: string | null
  device_key: string | null
  provider: string | null
  provider_code: string | null
  max_slots: number | null
  expires_at: string | null
  status: string | null
  legacy_metadata: JsonRecord | null
  created_at: string | null
}

function safeMetadata(value: JsonRecord | null | undefined): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function metadataString(metadata: JsonRecord | null | undefined, key: string): string {
  const value = safeMetadata(metadata)[key]
  return typeof value === 'string' ? value.trim() : ''
}

function clean(value: unknown): string {
  return String(value || '').trim()
}

function invalidCredential(value: unknown): boolean {
  const text = clean(value)
  return !text || /^(?:null|undefined)$/i.test(text) || /^(?:\*+|x{3,}|X{3,}|-+|_+|•+|●+)$/.test(text)
}

function isXcloud(app?: { key?: string | null; name?: string | null } | null): boolean {
  return /x\s*cloud|xcloud/i.test(`${app?.key || ''} ${app?.name || ''}`)
}

function painel2BaseUrl(): string {
  return String(process.env.PAINEL2_INTERNAL_URL || process.env.NEXT_PUBLIC_PAINEL2_URL || 'http://127.0.0.1:3002').replace(/\/+$/, '')
}

function formatDateBR(value: unknown): string {
  const text = clean(value)
  if (!text) return ''
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(date)
}

async function dispatchAccessUpdated(input: {
  dryRun: boolean
  phone: string
  client: ClientRow
  appName: string
  panelName: string
  dueAt: string
  credentials: { username: string; password: string; host?: string; providerCode?: string; code?: string; dns?: string }
}) {
  const response = await fetch(`${painel2BaseUrl()}/api/flows/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flow: 'access_updated',
      dryRun: input.dryRun,
      phone: input.phone,
      idempotency_key: `access_updated_full_adult:${input.client.id}:${Date.now()}`,
      client: { name: input.client.name || 'Cliente', phone: input.phone },
      activation: {
        app: input.appName,
        panel: input.panelName,
        dueAt: formatDateBR(input.dueAt),
        vencimento: formatDateBR(input.dueAt),
        username: input.credentials.username,
        password: input.credentials.password,
        host: input.credentials.host || '',
        dns: input.credentials.dns || input.credentials.host || '',
        provider_code: input.credentials.providerCode || '',
        providerCode: input.credentials.providerCode || '',
        code: input.credentials.code || input.credentials.providerCode || '',
      },
      context: {
        source: 'painel1_full_adult_upgrade',
        client_id: input.client.id,
      },
    }),
  })
  const payload = await response.json().catch(() => null) as JsonRecord | null
  return {
    ok: response.ok && payload?.ok !== false,
    status: response.ok ? 'processed' : 'failed',
    dry_run: Boolean(payload?.dryRun),
    code: typeof payload?.code === 'string' ? payload.code : `HTTP_${response.status}`,
    message: typeof payload?.message === 'string' ? maskSensitiveText(payload.message) : null,
    preview: payload?.preview || null,
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const body = await request.json().catch(() => ({})) as JsonRecord
  if (!id) return NextResponse.json({ success: false, error: 'Cliente nao informado.' }, { status: 400 })
  if (body.confirm !== true) {
    return NextResponse.json({ success: false, code: 'CONFIRMATION_REQUIRED', error: 'Confirmacao obrigatoria para trocar para completo +18.' }, { status: 409 })
  }

  const db = getSupabaseServerClient()
  if (!db) return NextResponse.json({ success: false, error: 'Supabase server env ausente.' }, { status: 500 })

  const [clientRes, directAccountsRes, slotsRes, appsRes, panelsRes, renewalsRes] = await Promise.all([
    db.from('clients').select('id,name,phone_e164,phone_raw,status,legacy_metadata').eq('id', id).maybeSingle(),
    db.from('accounts').select('id,client_id,app_id,panel_id,username,password_secret,device_key,provider,provider_code,max_slots,expires_at,status,legacy_metadata,created_at').eq('client_id', id).order('created_at', { ascending: false }),
    db.from('account_slots').select('id,account_id,client_id,slot_number,status,assigned_at').eq('client_id', id),
    db.from('apps').select('id,key,name'),
    db.from('panels').select('id,key,name'),
    db.from('renewals').select('id,account_id,slot_id,due_at,metadata').eq('client_id', id).order('created_at', { ascending: false }).limit(1),
  ])

  for (const result of [clientRes, directAccountsRes, slotsRes, appsRes, panelsRes, renewalsRes]) {
    if (result.error) return NextResponse.json({ success: false, error: result.error.message }, { status: 500 })
  }
  if (!clientRes.data) return NextResponse.json({ success: false, error: 'Cliente nao encontrado.' }, { status: 404 })

  const client = clientRes.data as ClientRow
  if (String(client.status || '').toLowerCase() !== 'active') {
    return NextResponse.json({ success: false, code: 'CLIENT_NOT_ACTIVE', error: 'A troca para completo +18 exige cliente ativo.' }, { status: 409 })
  }

  const clientSlots = (slotsRes.data || []) as AccountSharingSlot[]
  const slotAccountIds = [...new Set(clientSlots.map((slot) => slot.account_id).filter(Boolean))]
  const directAccounts = (directAccountsRes.data || []) as AccountRow[]
  const byId = new Map(directAccounts.map((row) => [row.id, row]))
  if (slotAccountIds.length) {
    const slotAccountsRes = await db
      .from('accounts')
      .select('id,client_id,app_id,panel_id,username,password_secret,device_key,provider,provider_code,max_slots,expires_at,status,legacy_metadata,created_at')
      .in('id', slotAccountIds)
    if (slotAccountsRes.error) return NextResponse.json({ success: false, error: slotAccountsRes.error.message }, { status: 500 })
    for (const row of (slotAccountsRes.data || []) as AccountRow[]) byId.set(row.id, row)
  }

  const account = findAccountForClient(id, [...byId.values()], clientSlots)
  if (!account) return NextResponse.json({ success: false, code: 'ACCOUNT_NOT_FOUND', error: 'Cliente ativo sem conta vinculada para atualizar.' }, { status: 404 })

  const allSlotsRes = await db.from('account_slots').select('id,account_id,client_id,slot_number,status').eq('account_id', account.id)
  if (allSlotsRes.error) return NextResponse.json({ success: false, error: allSlotsRes.error.message }, { status: 500 })
  const occupiedByOthers = ((allSlotsRes.data || []) as AccountSharingSlot[]).filter((slot) => isOccupiedSlot(slot) && slot.client_id && slot.client_id !== id)
  if (occupiedByOthers.length) {
    return NextResponse.json({
      success: false,
      code: 'SHARED_ACCOUNT_PACKAGE_SWAP_UNSAFE',
      error: 'Esta conta tem outro cliente vinculado. Trocar o pacote alteraria o acesso compartilhado; use uma nova conta controlada.',
    }, { status: 409 })
  }

  const appsById = new Map(((appsRes.data || []) as Array<{ id: string; key: string; name: string }>).map((row) => [row.id, row]))
  const panelsById = new Map(((panelsRes.data || []) as Array<{ id: string; key: string; name: string }>).map((row) => [row.id, row]))
  const app = account.app_id ? appsById.get(account.app_id) : null
  const panel = account.panel_id ? panelsById.get(account.panel_id) : null
  const panelKey = fullAdultPanelKey({ panel_key: panel?.key, panel_name: panel?.name, provider: account.provider })
  if (!panelKey) {
    return NextResponse.json({ success: false, code: 'FULL_ADULT_PANEL_NOT_SUPPORTED', error: fullAdultApiMissingMessage({ panel_key: panel?.key, panel_name: panel?.name, provider: account.provider }) }, { status: 400 })
  }

  const now = new Date().toISOString()
  const accountMetadata = safeMetadata(account.legacy_metadata)
  const clientMetadata = safeMetadata(client.legacy_metadata)
  const pending = safeMetadata(clientMetadata.full_adult_upgrade_pending as JsonRecord | null)
  const pendingCredentials = safeMetadata(pending.credentials as JsonRecord | null)
  const reusePending = pending.account_id === account.id &&
    pending.status === 'xcloud_failed' &&
    !invalidCredential(pendingCredentials.username) &&
    !invalidCredential(pendingCredentials.password)

  let credentials = {
    username: clean(pendingCredentials.username),
    password: clean(pendingCredentials.password),
    host: clean(pendingCredentials.host || pendingCredentials.dns),
    dns: clean(pendingCredentials.dns || pendingCredentials.host),
    providerCode: clean(pendingCredentials.provider_code || pendingCredentials.providerCode || pendingCredentials.code),
  }
  let providerResponse: JsonRecord | null = reusePending ? safeMetadata(pending.provider_response as JsonRecord | null) : null

  if (!reusePending) {
    let generated: Awaited<ReturnType<typeof createFullAdultAccess>>
    try {
      generated = await createFullAdultAccess({
        client_name: client.name || id,
        phone: client.phone_e164 || client.phone_raw || '',
        app_key: app?.key || '',
        panel_key: panel?.key || '',
        panel_name: panel?.name || '',
        provider: account.provider,
        device_key: account.device_key,
      })
    } catch (error) {
      return NextResponse.json({
        success: false,
        code: 'FULL_ADULT_API_FAILED',
        error: maskSensitiveText(error instanceof Error ? error.message : String(error)),
      }, { status: 502 })
    }
    credentials = {
      username: generated.username,
      password: generated.password,
      host: generated.host || generated.dns || '',
      dns: generated.dns || generated.host || '',
      providerCode: generated.provider_code || account.provider_code || '',
    }
    providerResponse = generated.raw_provider_response || null
  }

  if (invalidCredential(credentials.username) || invalidCredential(credentials.password)) {
    return NextResponse.json({ success: false, code: 'ACCESS_CREDENTIALS_INCOMPLETE', error: 'API completo +18 retornou credenciais incompletas.' }, { status: 502 })
  }
  if (isXcloud(app) && invalidCredential(credentials.host)) {
    return NextResponse.json({ success: false, code: 'XCLOUD_HOST_REQUIRED', error: 'API completo +18 retornou acesso XCloud sem Host.' }, { status: 502 })
  }

  const pkg = packageMetadata('full_adult')
  const dueAt = ((renewalsRes.data || [])[0] as { due_at?: string | null } | undefined)?.due_at || account.expires_at || now
  const backup = {
    username: account.username || null,
    password_secret: account.password_secret || null,
    host: metadataString(accountMetadata, 'host') || metadataString(accountMetadata, 'dns') || null,
    provider_code: account.provider_code || metadataString(accountMetadata, 'provider_code') || null,
    backed_up_at: now,
  }
  const pendingPatch = {
    status: 'pending_xcloud',
    account_id: account.id,
    generated_at: now,
    credentials: {
      username: credentials.username,
      password: credentials.password,
      host: credentials.host || null,
      dns: credentials.dns || null,
      provider_code: credentials.providerCode || null,
      code: credentials.providerCode || null,
    },
    provider_response: providerResponse,
    previous_credentials: backup,
  }

  await db.from('clients').update({
    legacy_metadata: {
      ...clientMetadata,
      full_adult_upgrade_pending: pendingPatch,
    },
  }).eq('id', id)

  let xcloudWorker: JsonRecord | null = null
  if (isXcloud(app)) {
    const deviceKey = clean(account.device_key || metadataString(accountMetadata, 'device_key'))
    if (!deviceKey) {
      return NextResponse.json({ success: false, code: 'XCLOUD_DEVICE_KEY_REQUIRED', error: 'Cliente XCloud sem device key para reconfigurar.' }, { status: 409 })
    }
    xcloudWorker = await runXcloudWorker({
      mode: 'recreate_device',
      confirm_recreate: true,
      device_key: deviceKey,
      host: credentials.host,
      username: credentials.username,
      password: credentials.password,
      operator_ref: 'painel_web_full_adult_upgrade',
    }).catch((error) => ({
      status: 'failed',
      stage: typeof (error as { stage?: unknown }).stage === 'string' ? (error as { stage: string }).stage : 'GenerateAccess',
      device_added: false,
      xtream_attached: false,
      confirmation_found: false,
      message: maskSensitiveText(error instanceof Error ? error.message : String(error)),
    })) as unknown as JsonRecord
    if (xcloudWorker.status !== 'success') {
      await db.from('clients').update({
        legacy_metadata: {
          ...clientMetadata,
          full_adult_upgrade_pending: {
            ...pendingPatch,
            status: 'xcloud_failed',
            failed_at: new Date().toISOString(),
            xcloud_worker: xcloudWorker,
          },
        },
      }).eq('id', id)
      return NextResponse.json({
        success: false,
        code: 'XCLOUD_RECONFIGURE_FAILED',
        error: `XCloud falhou na troca para completo +18: ${maskSensitiveText(String(xcloudWorker.message || xcloudWorker.stage || 'falha'))}`,
        xcloud_worker: xcloudWorker,
      }, { status: 502 })
    }
  }

  const finalAccountMetadata = {
    ...accountMetadata,
    ...pkg,
    host: credentials.host || null,
    dns: credentials.dns || credentials.host || null,
    provider_code: credentials.providerCode || account.provider_code || null,
    previous_credentials_before_full_adult: backup,
    full_adult_upgrade: {
      status: 'completed',
      completed_at: now,
      provider_response: providerResponse,
      xcloud_worker: xcloudWorker,
    },
  }
  const { error: accountUpdateError } = await db.from('accounts').update({
    username: credentials.username,
    password_secret: credentials.password,
    provider_code: credentials.providerCode || account.provider_code,
    legacy_metadata: finalAccountMetadata,
  }).eq('id', account.id)
  if (accountUpdateError) return NextResponse.json({ success: false, error: accountUpdateError.message }, { status: 500 })

  const finalClientMetadata = {
    ...clientMetadata,
    ...pkg,
    active_account_id: account.id,
    full_adult_upgrade_pending: null,
    full_adult_upgrade: {
      status: 'completed',
      completed_at: now,
      account_id: account.id,
      xcloud_worker: xcloudWorker,
    },
  }
  await db.from('clients').update({ legacy_metadata: finalClientMetadata }).eq('id', id)

  const renewal = ((renewalsRes.data || [])[0] || null) as { id?: string; metadata?: JsonRecord | null } | null
  if (renewal?.id) {
    await db.from('renewals').update({
      metadata: {
        ...safeMetadata(renewal.metadata),
        ...pkg,
        full_adult_upgrade_at: now,
      },
    }).eq('id', renewal.id)
  }

  const sendMessage = body.send_message !== false
  const dispatch = sendMessage
    ? await dispatchAccessUpdated({
      dryRun: body.dryRun === true,
      phone: client.phone_e164 || client.phone_raw || '',
      client,
      appName: app?.name || 'Aplicativo',
      panelName: panel?.name || account.provider || 'Painel',
      dueAt,
      credentials: {
        username: credentials.username,
        password: credentials.password,
        host: credentials.host,
        dns: credentials.dns,
        providerCode: credentials.providerCode,
        code: credentials.providerCode,
      },
    })
    : { status: 'skipped', ok: false, dry_run: false, code: 'MESSAGE_DISABLED', message: 'Mensagem nao enviada por opcao do operador.' }

  await db.from('logs').insert({
    scope: 'client',
    level: 'success',
    event: 'CLIENT_FULL_ADULT_UPGRADED',
    client_id: id,
    account_id: account.id,
    message: 'Cliente atualizado para pacote completo +18.',
    metadata: {
      app_key: app?.key || null,
      panel_key: panel?.key || null,
      xcloud: isXcloud(app),
      dispatch,
    },
  }).then(() => null)

  return NextResponse.json({
    success: true,
    client_id: id,
    account_id: account.id,
    package_type: 'full_adult',
    adult_content: true,
    xcloud_worker: xcloudWorker,
    dispatch,
  })
}
