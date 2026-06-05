import { NextResponse } from 'next/server'

import {
  buildProviderCredentials,
  findProvider,
  listCompatibleApps,
  type ProviderCatalogEntry,
  type BuiltCredentials,
} from '@/lib/config/provider-catalog'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type JsonRecord = Record<string, unknown>

type RouteContext = {
  params: Promise<{ id: string }>
}

type AccountRow = {
  id: string
  client_id: string | null
  username: string | null
  password_secret: string | null
  m3u_url_secret?: string | null
  hls_url_secret?: string | null
  provider: string | null
  provider_code: string | null
  panel_external_id: string | null
  app_id: string | null
  panel_id: string | null
  expires_at: string | null
  legacy_metadata: JsonRecord | null
}

function metadataValue(metadata: JsonRecord | null | undefined, keys: string[]): string {
  const source = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function hostFromUrl(value: string): string {
  try {
    const url = new URL(value)
    return url.origin
  } catch {
    return ''
  }
}

function buildCredentialText(item: BuiltCredentials): string {
  return [
    `App: ${item.app}`,
    item.providerCode ? `Provider: ${item.providerCode}` : null,
    item.code ? `Codigo: ${item.code}` : null,
    item.dns ? `DNS: ${item.dns}` : null,
    item.host ? `Host: ${item.host}` : null,
    item.username ? `Usuario: ${item.username}` : null,
    item.password ? `Senha: ${item.password}` : null,
    item.downloader ? `Downloader: ${item.downloader}` : null,
    item.ntdown ? `NTDown: ${item.ntdown}` : null,
  ].filter(Boolean).join('\n')
}

function resolveProvider(candidates: Array<string | null | undefined>): ProviderCatalogEntry | undefined {
  for (const candidate of candidates) {
    const provider = findProvider(String(candidate || ''))
    if (provider) return provider
  }
  return undefined
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  if (!id) return NextResponse.json({ success: false, error: 'Cliente nao informado.' }, { status: 400 })

  const db = getSupabaseServerClient()
  if (!db) return NextResponse.json({ success: false, error: 'Supabase server env ausente.' }, { status: 500 })

  const [clientRes, accountsRes, slotsRes, appsRes, panelsRes, renewalsRes] = await Promise.all([
    db.from('clients').select('id,name,phone_e164,status').eq('id', id).maybeSingle(),
    db.from('accounts').select('id,client_id,username,password_secret,m3u_url_secret,hls_url_secret,provider,provider_code,panel_external_id,app_id,panel_id,expires_at,legacy_metadata,created_at').eq('client_id', id).order('created_at', { ascending: false }),
    db.from('account_slots').select('id,account_id,client_id,slot_number,status').eq('client_id', id),
    db.from('apps').select('id,name,key'),
    db.from('panels').select('id,name,key'),
    db.from('renewals').select('plan_key,amount_cents,due_at,status').eq('client_id', id).order('created_at', { ascending: false }).limit(1),
  ])

  for (const result of [clientRes, accountsRes, slotsRes, appsRes, panelsRes, renewalsRes]) {
    if (result.error) return NextResponse.json({ success: false, error: result.error.message }, { status: 500 })
  }
  if (!clientRes.data) return NextResponse.json({ success: false, error: 'Cliente nao encontrado.' }, { status: 404 })

  const accounts = (accountsRes.data || []) as AccountRow[]
  const account = accounts[0] || null
  const appsById = new Map(((appsRes.data || []) as Array<{ id: string; name: string; key: string }>).map((row) => [row.id, row]))
  const panelsById = new Map(((panelsRes.data || []) as Array<{ id: string; name: string; key: string }>).map((row) => [row.id, row]))
  const app = account?.app_id ? appsById.get(account.app_id) : null
  const panel = account?.panel_id ? panelsById.get(account.panel_id) : null
  const renewal = (renewalsRes.data || [])[0] as { plan_key?: string | null; amount_cents?: number | null; due_at?: string | null; status?: string | null } | undefined
  const metadata = account?.legacy_metadata || {}

  const provider = resolveProvider([
    panel?.key,
    panel?.name,
    account?.provider,
    metadataValue(metadata, ['provider', 'panel', 'painel', 'server', 'servidor']),
  ])
  if (!provider || !account) {
    return NextResponse.json({
      success: true,
      client: clientRes.data,
      account: account ? { id: account.id, username: account.username, password: account.password_secret, hasSlot: false } : null,
      provider: null,
      apps: [],
      warnings: ['Cliente sem conta/credencial vinculada ou painel sem catalogo.'],
    })
  }

  const username = account.username || metadataValue(metadata, ['username', 'usuario', 'xtream_username'])
  const password = account.password_secret || metadataValue(metadata, ['password', 'senha', 'xtream_password'])
  const m3u = account.m3u_url_secret || metadataValue(metadata, ['m3u', 'm3u_url', 'm3uUrl', 'optional_m3u_url'])
  const hls = account.hls_url_secret || metadataValue(metadata, ['hls', 'hls_url', 'hlsUrl', 'optional_hls_url'])
  const host =
    metadataValue(metadata, ['host', 'dns', 'xtream_host']) ||
    hostFromUrl(m3u) ||
    provider.defaultHost ||
    ''
  const preferredApp = app?.key || app?.name || account.provider_code || undefined
  const apps = listCompatibleApps(provider.key).map((catalogApp) => {
    const built = buildProviderCredentials({
      provider: provider.key,
      app: catalogApp.key,
      username,
      password,
      host,
    })
    return { ...built, credentialText: buildCredentialText(built) }
  })
  const preferred = buildProviderCredentials({ provider: provider.key, app: preferredApp, username, password, host })
  const hasSlot = Boolean((slotsRes.data || []).length)
  const warnings: string[] = []
  if (String((clientRes.data as { status?: string | null }).status || '').toLowerCase() === 'active' && !hasSlot) {
    warnings.push('Cliente ativo sem vaga/slot vinculado.')
  }

  return NextResponse.json({
    success: true,
    client: clientRes.data,
    provider: { key: provider.key, name: provider.name, panelUrl: provider.panelUrl },
    account: {
      id: account.id,
      username,
      password,
      host,
      m3u: m3u || preferred.m3uUrl,
      hls: hls || preferred.hlsUrl,
      expiresAt: account.expires_at || renewal?.due_at || null,
      hasSlot,
    },
    selectedApp: app ? { key: app.key, name: app.name } : null,
    plan: renewal ? { key: renewal.plan_key, amountCents: renewal.amount_cents, dueAt: renewal.due_at, status: renewal.status } : null,
    apps,
    warnings,
  })
}
