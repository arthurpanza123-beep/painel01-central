import { NextRequest, NextResponse } from 'next/server'

import { maskDeviceKey, maskSensitiveText } from '@/lib/services/masking'
import { runXcloudWorker, xcloudWorkerErrorResponse } from '@/lib/services/xcloud-worker'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type JsonRecord = Record<string, unknown>

type RouteContext = {
  params: Promise<{ id: string }>
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
  m3u_url_secret: string | null
  hls_url_secret: string | null
  legacy_metadata: JsonRecord | null
  created_at: string | null
}

function metadata(value: JsonRecord | null | undefined): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function metadataString(source: JsonRecord | null | undefined, key: string): string {
  const value = metadata(source)[key]
  return typeof value === 'string' ? value.trim() : ''
}

function parseHostFromUrl(value: string): string {
  if (!value) return ''
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}`
  } catch {
    return ''
  }
}

function safeMetadata(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value, (key, item: unknown) => {
    if (typeof item !== 'string') return item
    if (/password|senha/i.test(key)) return '***'
    if (/device/i.test(key)) return maskDeviceKey(item)
    return maskSensitiveText(item)
  })) as JsonRecord
}

async function writeLog(db: NonNullable<ReturnType<typeof getSupabaseServerClient>>, input: {
  clientId: string
  accountId?: string | null
  event: string
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
  metadata?: JsonRecord
}) {
  await db.from('logs').insert({
    scope: 'xcloud_debug',
    level: input.level,
    event: input.event,
    client_id: input.clientId,
    account_id: input.accountId || null,
    message: maskSensitiveText(input.message).slice(0, 800),
    metadata: safeMetadata(input.metadata || {}),
  }).then(() => null)
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const body = await req.json().catch(() => ({})) as { confirm?: boolean; operator_ref?: string } | null
  if (!id) return NextResponse.json({ success: false, code: 'CLIENT_ID_REQUIRED', error: 'Cliente nao informado.' }, { status: 400 })
  if (!body?.confirm) return NextResponse.json({ success: false, code: 'CONFIRM_REQUIRED', error: 'Confirme a execucao manual do Debug XCloud.' }, { status: 409 })

  const db = getSupabaseServerClient()
  if (!db) return NextResponse.json({ success: false, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase server env ausente.' }, { status: 500 })

  try {
    const { data: clientData, error: clientError } = await db
      .from('clients')
      .select('id,name,phone_e164,legacy_metadata')
      .eq('id', id)
      .maybeSingle()
    if (clientError) throw new Error(clientError.message)
    if (!clientData) return NextResponse.json({ success: false, code: 'CLIENT_NOT_FOUND', error: 'Cliente nao encontrado.' }, { status: 404 })

    const { data: accountsData, error: accountsError } = await db
      .from('accounts')
      .select('id,client_id,app_id,panel_id,username,password_secret,device_key,provider,provider_code,m3u_url_secret,hls_url_secret,legacy_metadata,created_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (accountsError) throw new Error(accountsError.message)

    const accounts = (accountsData || []) as AccountRow[]
    const appIds = Array.from(new Set(accounts.map((account) => account.app_id).filter(Boolean))) as string[]
    const appsRes = appIds.length ? await db.from('apps').select('id,key,name').in('id', appIds) : { data: [], error: null }
    if (appsRes.error) throw new Error(appsRes.error.message)
    const appsById = new Map((appsRes.data || []).map((app: { id: string; key: string; name: string }) => [app.id, app]))

    const account = accounts.find((item) => {
      const app = item.app_id ? appsById.get(item.app_id) : null
      return /x\s*cloud|xcloud/i.test(`${app?.key || ''} ${app?.name || ''} ${item.provider || ''} ${metadataString(item.legacy_metadata, 'app_label')}`)
    }) || accounts.find((item) => item.device_key || metadataString(item.legacy_metadata, 'device_key'))

    if (!account) return NextResponse.json({ success: false, code: 'XCLOUD_ACCOUNT_NOT_FOUND', error: 'Nenhuma conta XCloud vinculada ao cliente.' }, { status: 404 })

    const accountMetadata = metadata(account.legacy_metadata)
    const clientMetadata = metadata((clientData as { legacy_metadata?: JsonRecord | null }).legacy_metadata)
    const host = metadataString(accountMetadata, 'host') ||
      metadataString(accountMetadata, 'dns') ||
      metadataString(clientMetadata, 'host') ||
      metadataString(clientMetadata, 'dns') ||
      parseHostFromUrl(account.m3u_url_secret || account.hls_url_secret || '')
    const username = account.username || metadataString(accountMetadata, 'username') || metadataString(clientMetadata, 'username')
    const password = account.password_secret || metadataString(accountMetadata, 'password') || metadataString(clientMetadata, 'password')
    const deviceKey = account.device_key || metadataString(accountMetadata, 'device_key') || metadataString(clientMetadata, 'device_key')

    if (!deviceKey || !host || !username || !password) {
      await writeLog(db, {
        clientId: id,
        accountId: account.id,
        event: 'XCLOUD_DEBUG_BLOCKED_INCOMPLETE_CREDENTIALS',
        level: 'warning',
        message: 'Debug XCloud bloqueado por dados incompletos.',
        metadata: { has_device_key: Boolean(deviceKey), has_host: Boolean(host), has_username: Boolean(username), has_password: Boolean(password) },
      })
      return NextResponse.json({ success: false, code: 'XCLOUD_DATA_INCOMPLETE', error: 'Conta XCloud sem device key, URL, usuario ou senha suficientes para debug.' }, { status: 409 })
    }

    await writeLog(db, {
      clientId: id,
      accountId: account.id,
      event: 'XCLOUD_DEBUG_STARTED',
      level: 'warning',
      message: 'Debug XCloud manual iniciado pelo operador.',
      metadata: { device_key: deviceKey, operator_ref: body.operator_ref || 'painel_web' },
    })

    const result = await runXcloudWorker({
      mode: 'recreate_device',
      confirm_recreate: true,
      device_key: deviceKey,
      host,
      username,
      password,
      operator_ref: body.operator_ref || 'painel_web_xcloud_debug',
    })

    await writeLog(db, {
      clientId: id,
      accountId: account.id,
      event: result.status === 'success' ? 'XCLOUD_DEBUG_COMPLETED' : 'XCLOUD_DEBUG_FAILED',
      level: result.status === 'success' ? 'success' : 'error',
      message: result.status === 'success' ? 'Debug XCloud manual concluido.' : 'Debug XCloud manual falhou.',
      metadata: { result },
    })

    return NextResponse.json({
      success: result.status === 'success',
      client_id: id,
      account_id: account.id,
      saved_xtream: { host, username },
      result,
    }, { status: result.status === 'success' ? 200 : 500 })
  } catch (error) {
    const response = xcloudWorkerErrorResponse(error)
    await writeLog(db, {
      clientId: id,
      event: 'XCLOUD_DEBUG_EXCEPTION',
      level: 'error',
      message: response.body.error || 'Debug XCloud falhou.',
      metadata: { code: response.body.code },
    }).catch(() => null)
    return NextResponse.json({ ...response.body, success: false }, { status: response.status })
  }
}
