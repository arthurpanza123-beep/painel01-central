import { NextRequest, NextResponse } from 'next/server'

import { maskSensitiveText } from '@/lib/services/masking'
import {
  normalizePlanKey,
  normalizeScreensCount,
  officialPlanLabel,
  type ScreensCount,
} from '@/lib/services/official-plans'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type JsonRecord = Record<string, unknown>

type RouteContext = {
  params: Promise<{ id: string }>
}

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
  provider: string | null
  provider_code: string | null
  max_slots: number | null
  expires_at: string | null
  legacy_metadata: JsonRecord | null
}

type SlotRow = {
  id: string
  account_id: string
  client_id: string | null
  slot_number: number
  status: string | null
  metadata: JsonRecord | null
}

type RenewalRow = {
  id: string
  account_id: string | null
  slot_id: string | null
  plan_key: string | null
  amount_cents: number | null
  status: string | null
  due_at: string | null
  metadata: JsonRecord | null
}

function safeMetadata(value: JsonRecord | null | undefined): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizePhone(value: unknown): string {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

function normalizeStatus(value: unknown): string {
  const key = String(value || 'active')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (key === 'ativo' || key === 'active') return 'active'
  if (key === 'expirado' || key === 'expired') return 'expired'
  if (key === 'pendente' || key === 'pending') return 'pending'
  if (key === 'suspenso' || key === 'suspended') return 'suspended'
  if (key === 'lead') return 'lead'
  return 'active'
}

function normalizeLookupKey(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function amountToCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed > 999 ? Math.round(parsed) : Math.round(parsed * 100)
}

function parseDueAt(value: unknown): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T23:59:59-03:00`)
    : new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

async function resolveIdByKeyOrName(
  db: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  table: 'apps' | 'panels',
  value: unknown,
) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const key = normalizeLookupKey(raw)
  const { data, error } = await db.from(table).select('id,key,name')
  if (error) return null
  const row = ((data || []) as Array<{ id?: string; key?: string | null; name?: string | null }>).find((item) => (
    normalizeLookupKey(item.key) === key ||
    normalizeLookupKey(item.name) === key ||
    normalizeLookupKey(item.name).includes(key) ||
    key.includes(normalizeLookupKey(item.name))
  ))
  return row?.id || null
}

async function writeClientLog(
  db: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  clientId: string,
  event: string,
  message: string,
  metadata: JsonRecord,
) {
  await db.from('logs').insert({
    scope: 'client',
    level: 'info',
    event,
    client_id: clientId,
    message: maskSensitiveText(message),
    metadata,
  }).then(() => null)
}

async function ensureClientScreens(input: {
  db: NonNullable<ReturnType<typeof getSupabaseServerClient>>
  clientId: string
  account: AccountRow | null
  screensCount: ScreensCount
  dueAt: string | null
}) {
  const warnings: string[] = []
  if (!input.account || input.screensCount < 2) return { slotIds: [] as string[], warnings }

  const { data: slotsData, error } = await input.db
    .from('account_slots')
    .select('id,account_id,client_id,slot_number,status,metadata')
    .eq('account_id', input.account.id)
    .order('slot_number', { ascending: true })

  if (error) {
    warnings.push(`Falha ao consultar telas: ${error.message}`)
    return { slotIds: [] as string[], warnings }
  }

  const slots = (slotsData || []) as SlotRow[]
  const clientSlots = slots.filter((slot) => slot.client_id === input.clientId)
  const missing = input.screensCount - clientSlots.length
  const freeSlots = slots.filter((slot) =>
    !slot.client_id && ['free', 'released'].includes(String(slot.status || 'free'))
  )

  const claimed: string[] = clientSlots.map((slot) => slot.id)
  if (missing > 0 && freeSlots.length < missing) {
    warnings.push('Cliente marcado com 2 telas, mas nao havia segunda tela livre segura para ocupar automaticamente.')
    return { slotIds: claimed, warnings }
  }

  for (const slot of freeSlots.slice(0, Math.max(0, missing))) {
    const { data: updated, error: updateError } = await input.db
      .from('account_slots')
      .update({
        client_id: input.clientId,
        status: 'occupied',
        assigned_at: new Date().toISOString(),
        released_at: null,
        expires_at: input.dueAt || undefined,
        metadata: {
          ...safeMetadata(slot.metadata),
          paid_second_screen: true,
          screens_count: input.screensCount,
        },
      })
      .eq('id', slot.id)
      .is('client_id', null)
      .in('status', ['free', 'released'])
      .select('id')
      .maybeSingle()

    if (updateError || !updated) {
      warnings.push(`Nao foi possivel ocupar a tela ${slot.slot_number} automaticamente.`)
      continue
    }
    claimed.push(slot.id)
  }

  if (input.dueAt) {
    await input.db
      .from('account_slots')
      .update({ expires_at: input.dueAt })
      .eq('account_id', input.account.id)
      .eq('client_id', input.clientId)
      .then(() => null)
  }

  return { slotIds: claimed, warnings }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  if (!id) return NextResponse.json({ success: false, error: 'Cliente nao informado.' }, { status: 400 })

  const db = getSupabaseServerClient()
  if (!db) return NextResponse.json({ success: false, error: 'Supabase server env ausente.' }, { status: 500 })

  const body = await request.json().catch(() => null) as JsonRecord | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'JSON invalido.' }, { status: 400 })
  }

  const { data: clientData, error: clientError } = await db
    .from('clients')
    .select('id,name,phone_e164,phone_raw,status,legacy_metadata')
    .eq('id', id)
    .maybeSingle()

  if (clientError) return NextResponse.json({ success: false, error: clientError.message }, { status: 500 })
  if (!clientData) return NextResponse.json({ success: false, error: 'Cliente nao encontrado.' }, { status: 404 })

  const client = clientData as ClientRow
  const planKey = normalizePlanKey(body.plan_key ?? body.plan)
  const screensCount = normalizeScreensCount(body.screens_count ?? body.screens)
  const amountCents = amountToCents(body.amount_cents ?? body.amount)
  const dueAt = parseDueAt(body.due_at ?? body.dueAt ?? body.vencimento)
  const phone = normalizePhone(body.phone ?? body.phone_e164 ?? body.telefone)
  const now = new Date().toISOString()

  const appLabel = String(body.app ?? body.app_label ?? '').trim()
  const panelLabel = String(body.panel ?? body.provider ?? body.panel_label ?? '').trim()
  const host = String(body.host ?? body.dns ?? '').trim()
  const providerCode = String(body.provider_code ?? body.providerCode ?? '').trim()
  const notes = String(body.notes ?? body.observations ?? '').trim()

  const clientMetadata = {
    ...safeMetadata(client.legacy_metadata),
    app_label: appLabel || safeMetadata(client.legacy_metadata).app_label || null,
    panel_label: panelLabel || safeMetadata(client.legacy_metadata).panel_label || null,
    provider_label: panelLabel || safeMetadata(client.legacy_metadata).provider_label || null,
    plan_key: planKey,
    plan_label: officialPlanLabel(planKey, screensCount),
    screens_count: screensCount,
    amount_cents: amountCents ?? safeMetadata(client.legacy_metadata).amount_cents ?? null,
    renewal_due_at: dueAt || safeMetadata(client.legacy_metadata).renewal_due_at || null,
    host: host || safeMetadata(client.legacy_metadata).host || null,
    dns: host || safeMetadata(client.legacy_metadata).dns || null,
    provider_code: providerCode || safeMetadata(client.legacy_metadata).provider_code || null,
    operational_notes: notes || safeMetadata(client.legacy_metadata).operational_notes || null,
    updated_by_client_editor_at: now,
  }

  const clientUpdate: JsonRecord = {
    name: String(body.name ?? body.nome ?? client.name ?? '').trim() || client.name,
    status: normalizeStatus(body.status ?? client.status),
    legacy_metadata: clientMetadata,
  }
  if (phone) {
    clientUpdate.phone_e164 = phone
    clientUpdate.phone_raw = String(body.phone ?? body.telefone ?? phone)
  }

  const { error: updateClientError } = await db.from('clients').update(clientUpdate).eq('id', id)
  if (updateClientError) return NextResponse.json({ success: false, error: updateClientError.message }, { status: 500 })

  const { data: accountsData, error: accountsError } = await db
    .from('accounts')
    .select('id,client_id,app_id,panel_id,username,password_secret,provider,provider_code,max_slots,expires_at,legacy_metadata')
    .eq('client_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
  if (accountsError) return NextResponse.json({ success: false, error: accountsError.message }, { status: 500 })

  const account = ((accountsData || [])[0] || null) as AccountRow | null
  const warnings: string[] = []
  let accountId = account?.id || null

  if (account) {
    const [appId, panelId] = await Promise.all([
      resolveIdByKeyOrName(db, 'apps', appLabel),
      resolveIdByKeyOrName(db, 'panels', panelLabel),
    ])
    const accountUpdate: JsonRecord = {
      app_id: appId || account.app_id,
      panel_id: panelId || account.panel_id,
      provider: panelLabel || account.provider,
      provider_code: providerCode || account.provider_code,
      max_slots: Math.max(Number(account.max_slots || 1), screensCount),
      expires_at: dueAt || account.expires_at,
      legacy_metadata: {
        ...safeMetadata(account.legacy_metadata),
        app_label: appLabel || null,
        panel_label: panelLabel || null,
        provider_label: panelLabel || null,
        host: host || null,
        dns: host || null,
        provider_code: providerCode || null,
        screens_count: screensCount,
        edited_from_client_drawer_at: now,
      },
    }
    const username = String(body.username ?? body.usuario ?? '').trim()
    const password = String(body.password ?? body.senha ?? '').trim()
    if (username) accountUpdate.username = username
    if (password && !password.includes('•')) accountUpdate.password_secret = password

    const { error: accountError } = await db.from('accounts').update(accountUpdate).eq('id', account.id)
    if (accountError) return NextResponse.json({ success: false, error: accountError.message }, { status: 500 })
  } else if (String(body.username ?? body.usuario ?? '').trim() || String(body.password ?? body.senha ?? '').trim()) {
    warnings.push('Credenciais foram salvas no cliente, mas nao havia conta vinculada segura para atualizar.')
  }

  const screenResult = await ensureClientScreens({ db, clientId: id, account, screensCount, dueAt })
  warnings.push(...screenResult.warnings)
  const primarySlotId = screenResult.slotIds[0] || null

  if (amountCents !== null || dueAt) {
    const { data: renewalsData, error: renewalLookupError } = await db
      .from('renewals')
      .select('id,account_id,slot_id,plan_key,amount_cents,status,due_at,metadata')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (renewalLookupError) return NextResponse.json({ success: false, error: renewalLookupError.message }, { status: 500 })

    const current = ((renewalsData || [])[0] || null) as RenewalRow | null
    const renewalPayload = {
      client_id: id,
      account_id: current?.account_id || accountId,
      slot_id: current?.slot_id || primarySlotId,
      plan_key: planKey,
      amount_cents: amountCents ?? current?.amount_cents ?? null,
      currency: 'BRL',
      status: current?.status || 'applied',
      due_at: dueAt || current?.due_at || null,
      paid_until: dueAt || current?.due_at || null,
      confirmed_at: now,
      operator_ref: 'painel_web_client_editor',
      metadata: {
        ...safeMetadata(current?.metadata),
        manual_client_edit: true,
        screens_count: screensCount,
        plan_label: officialPlanLabel(planKey, screensCount),
        second_screen_amount_cents: amountToCents(body.second_screen_amount_cents),
        note: notes || null,
        updated_at: now,
      },
    }

    if (current) {
      const { error: renewalError } = await db.from('renewals').update(renewalPayload).eq('id', current.id)
      if (renewalError) return NextResponse.json({ success: false, error: renewalError.message }, { status: 500 })
    } else {
      const { error: renewalError } = await db.from('renewals').insert(renewalPayload)
      if (renewalError) return NextResponse.json({ success: false, error: renewalError.message }, { status: 500 })
    }
  }

  const changedFields = [
    'name',
    phone ? 'phone' : null,
    'status',
    'app',
    'panel',
    'plan',
    'screens_count',
    amountCents !== null ? 'amount' : null,
    dueAt ? 'due_at' : null,
    String(body.username ?? body.usuario ?? '').trim() ? 'username' : null,
    String(body.password ?? body.senha ?? '').trim() ? 'password_changed' : null,
    host ? 'host' : null,
    providerCode ? 'provider_code' : null,
    notes ? 'notes' : null,
  ].filter(Boolean)

  await writeClientLog(db, id, 'CLIENT_UPDATED', `Cliente ${client.name || id} atualizado pelo Painel 1.`, {
    changed_fields: changedFields,
    plan_key: planKey,
    screens_count: screensCount,
    amount_cents: amountCents,
    due_at: dueAt,
    account_id: accountId,
    slot_ids: screenResult.slotIds,
    warnings,
  })

  await db.from('pipeline_events').insert({
    entity_type: 'client',
    entity_id: id,
    event_type: 'client_updated',
    from_status: client.status,
    to_status: normalizeStatus(body.status ?? client.status),
    operator_ref: 'painel_web_client_editor',
    payload: {
      changed_fields: changedFields,
      plan_key: planKey,
      screens_count: screensCount,
      amount_cents: amountCents,
      due_at: dueAt,
      warnings,
    },
  }).then(() => null)

  return NextResponse.json({
    success: true,
    client_id: id,
    plan_key: planKey,
    plan_label: officialPlanLabel(planKey, screensCount),
    screens_count: screensCount,
    amount_cents: amountCents,
    due_at: dueAt,
    warnings,
  })
}
