import { maskSensitiveText } from '@/lib/services/masking'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type JsonRecord = Record<string, unknown>

export type RenewClientInput = {
  client_id?: string
  plan?: string
  amount_cents?: number
  due_at?: string
  months_to_add?: number
  note?: string
  idempotency_key?: string
  operator_ref?: string
}

type ClientRow = {
  id: string
  name: string | null
  phone_e164: string | null
  status: string | null
  legacy_metadata: JsonRecord | null
}

type RenewalRow = {
  id: string
  client_id: string
  account_id: string | null
  slot_id: string | null
  plan_key: string
  amount_cents: number | null
  status: string
  due_at: string | null
  paid_until: string | null
  metadata: JsonRecord | null
  created_at: string | null
}

type AccountContext = {
  account_id: string | null
  slot_id: string | null
  app_name: string | null
  panel_name: string | null
}

class RenewalError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const runningRenewals = new Set<string>()
const runningRenewalClients = new Set<string>()

const PLAN_MONTHS: Record<string, number> = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
}

function db() {
  const client = getSupabaseServerClient()
  if (!client) throw new RenewalError(500, 'SUPABASE_NOT_CONFIGURED', 'Supabase server env ausente.')
  return client
}

function normalizePlan(value: unknown): string {
  const key = String(value || 'mensal')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (PLAN_MONTHS[key]) return key
  return 'mensal'
}

function safeMetadata(value: JsonRecord | null | undefined): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function parseDueAt(value?: string): Date | null {
  if (!value) return null
  const raw = String(value).trim()
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const date = br ? new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00.000Z`) : new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function addMonths(base: Date, months: number): Date {
  const next = new Date(base)
  const originalDate = next.getDate()
  next.setMonth(next.getMonth() + months)
  if (next.getDate() < originalDate) next.setDate(0)
  return next
}

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function amountToCents(value: unknown): number {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) throw new RenewalError(400, 'AMOUNT_REQUIRED', 'Informe amount_cents valido.')
  return Math.round(amount)
}

function painel2BaseUrl() {
  return String(process.env.PAINEL2_INTERNAL_URL || process.env.NEXT_PUBLIC_PAINEL2_URL || 'http://127.0.0.1:3002').replace(/\/+$/, '')
}

async function writeLog(event: string, level: 'info' | 'warning' | 'error' | 'success', payload: {
  client_id?: string | null
  account_id?: string | null
  message: string
  metadata?: JsonRecord
}) {
  const database = db()
  const line = `[${event}] ${maskSensitiveText(payload.message)} ${JSON.stringify(payload.metadata || {})}`
  if (level === 'error') console.error(line)
  else if (level === 'warning') console.warn(line)
  else console.log(line)

  const { error } = await database.from('logs').insert({
    scope: 'renewal',
    level,
    event,
    client_id: payload.client_id || null,
    account_id: payload.account_id || null,
    message: maskSensitiveText(payload.message),
    metadata: payload.metadata || {},
  })
  if (error) throw new RenewalError(500, 'LOG_WRITE_FAILED', error.message)
}

async function findExistingByKey(clientId: string, idempotencyKey: string) {
  const database = db()
  const { data, error } = await database
    .from('logs')
    .select('metadata,created_at')
    .eq('scope', 'renewal')
    .eq('event', 'RENEWAL_APPLIED')
    .eq('client_id', clientId)
    .contains('metadata', { idempotency_key: idempotencyKey })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new RenewalError(500, 'IDEMPOTENCY_LOOKUP_FAILED', error.message)
  return (data || [])[0] as { metadata?: JsonRecord; created_at?: string | null } | undefined
}

async function findRecentSimilar(clientId: string, fingerprint: string) {
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const database = db()
  const { data, error } = await database
    .from('logs')
    .select('metadata,created_at')
    .eq('scope', 'renewal')
    .eq('event', 'RENEWAL_APPLIED')
    .eq('client_id', clientId)
    .gte('created_at', since)
    .contains('metadata', { fingerprint })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new RenewalError(500, 'RECENT_RENEWAL_LOOKUP_FAILED', error.message)
  return (data || [])[0] as { metadata?: JsonRecord; created_at?: string | null } | undefined
}

async function findRecentClientRenewal(clientId: string) {
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const database = db()
  const { data, error } = await database
    .from('logs')
    .select('metadata,created_at')
    .eq('scope', 'renewal')
    .eq('event', 'RENEWAL_APPLIED')
    .eq('client_id', clientId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new RenewalError(500, 'RECENT_RENEWAL_LOOKUP_FAILED', error.message)
  return (data || [])[0] as { metadata?: JsonRecord; created_at?: string | null } | undefined
}

async function accountContext(clientId: string): Promise<AccountContext> {
  const database = db()
  const { data: slotData } = await database
    .from('account_slots')
    .select('id,account_id')
    .eq('client_id', clientId)
    .order('assigned_at', { ascending: false })
    .limit(1)

  const slot = (slotData || [])[0] as { id?: string; account_id?: string | null } | undefined
  if (!slot?.account_id) return { account_id: null, slot_id: slot?.id || null, app_name: null, panel_name: null }

  const { data: accountData } = await database
    .from('accounts')
    .select('id,app_id,panel_id')
    .eq('id', slot.account_id)
    .maybeSingle()

  const account = accountData as { id?: string; app_id?: string | null; panel_id?: string | null } | null
  const [appRes, panelRes] = await Promise.all([
    account?.app_id ? database.from('apps').select('name').eq('id', account.app_id).maybeSingle() : Promise.resolve({ data: null }),
    account?.panel_id ? database.from('panels').select('name').eq('id', account.panel_id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  return {
    account_id: slot.account_id,
    slot_id: slot.id || null,
    app_name: (appRes.data as { name?: string } | null)?.name || null,
    panel_name: (panelRes.data as { name?: string } | null)?.name || null,
  }
}

async function dispatchRenewal(input: {
  idempotencyKey: string
  client: ClientRow
  plan: string
  amountCents: number
  dueAt: string
  account: AccountContext
}) {
  const amount = `R$${(input.amountCents / 100).toFixed(2).replace('.', ',')}`
  const due = formatDateBR(input.dueAt)

  const response = await fetch(`${painel2BaseUrl()}/api/flows/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flow: 'renewal_created',
      idempotency_key: input.idempotencyKey,
      phone: input.client.phone_e164 || undefined,
      client: { name: input.client.name || '', phone: input.client.phone_e164 || '' },
      activation: {
        app: input.account.app_name || '',
        panel: input.account.panel_name || '',
        plan: planLabel(input.plan),
        amount,
        dueAt: due,
      },
      context: {
        source: 'painel1_renewal',
        client_id: input.client.id,
        idempotency_key: input.idempotencyKey,
        cliente: input.client.name || '',
        clientName: input.client.name || '',
        app: input.account.app_name || '',
        panel: input.account.panel_name || '',
        plan: planLabel(input.plan),
        valor: amount,
        amount,
        vencimento: due,
        dueAt: due,
      },
    }),
  })

  return response.json().catch(() => ({ ok: false, code: 'INVALID_RESPONSE' }))
}

function planLabel(plan: string): string {
  if (plan === 'mensal') return 'Mensal'
  if (plan === 'trimestral') return 'Trimestral'
  if (plan === 'semestral') return 'Semestral'
  if (plan === 'anual') return 'Anual'
  return plan
}

export async function renewClient(input: RenewClientInput) {
  const clientId = String(input.client_id || '').trim()
  if (!clientId) throw new RenewalError(400, 'CLIENT_ID_REQUIRED', 'Informe client_id.')

  const plan = normalizePlan(input.plan)
  const amountCents = amountToCents(input.amount_cents)
  const months = Number.isFinite(Number(input.months_to_add)) && Number(input.months_to_add) > 0
    ? Math.round(Number(input.months_to_add))
    : PLAN_MONTHS[plan]
  const providedIdempotencyKey = String(input.idempotency_key || '').trim()
  const idempotencyKey = providedIdempotencyKey || `renewal:${clientId}:${Date.now()}`
  const runningKey = `${clientId}:${idempotencyKey}`

  if (runningRenewals.has(runningKey) || runningRenewalClients.has(clientId)) {
    return { success: true, already_running: true, code: 'RENEWAL_ALREADY_RUNNING', idempotency_key: idempotencyKey }
  }

  runningRenewals.add(runningKey)
  runningRenewalClients.add(clientId)
  try {
    const database = db()
    const { data: clientData, error: clientError } = await database
      .from('clients')
      .select('id,name,phone_e164,status,legacy_metadata')
      .eq('id', clientId)
      .maybeSingle()

    if (clientError) throw new RenewalError(500, 'CLIENT_LOOKUP_FAILED', clientError.message)
    if (!clientData) throw new RenewalError(404, 'CLIENT_NOT_FOUND', 'Cliente nao encontrado.')

    const client = clientData as ClientRow
    if (client.status !== 'active') throw new RenewalError(409, 'CLIENT_NOT_ACTIVE', 'Renovacao exige cliente active.')

    const existingByKey = await findExistingByKey(clientId, idempotencyKey)
    if (existingByKey?.metadata) {
      await writeLog('RENEWAL_SKIPPED_ALREADY_PROCESSED', 'info', {
        client_id: clientId,
        message: 'Renovacao duplicada ignorada por idempotency_key.',
        metadata: { idempotency_key: idempotencyKey, renewal_id: existingByKey.metadata.renewal_id || null },
      })
      return {
        success: true,
        already_processed: true,
        code: 'RENEWAL_ALREADY_PROCESSED',
        idempotency_key: idempotencyKey,
        renewal: existingByKey.metadata,
      }
    }

    if (!providedIdempotencyKey) {
      const recentClientRenewal = await findRecentClientRenewal(clientId)
      if (recentClientRenewal?.metadata) {
        await writeLog('RENEWAL_SKIPPED_RECENT_DUPLICATE', 'info', {
          client_id: clientId,
          message: 'Renovacao duplicada recente ignorada sem idempotency_key explicita.',
          metadata: { idempotency_key: idempotencyKey, renewal_id: recentClientRenewal.metadata.renewal_id || null },
        })
        return {
          success: true,
          already_processed: true,
          code: 'RENEWAL_RECENT_DUPLICATE',
          idempotency_key: idempotencyKey,
          renewal: recentClientRenewal.metadata,
        }
      }
    }

    const { data: renewalsData, error: renewalsError } = await database
      .from('renewals')
      .select('id,client_id,account_id,slot_id,plan_key,amount_cents,status,due_at,paid_until,metadata,created_at')
      .eq('client_id', clientId)
      .not('status', 'eq', 'cancelled')
      .order('due_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)

    if (renewalsError) throw new RenewalError(500, 'RENEWAL_LOOKUP_FAILED', renewalsError.message)

    const current = (renewalsData || [])[0] as RenewalRow | undefined
    const baseDate = parseDueAt(current?.due_at || undefined) || new Date()
    const explicitDue = parseDueAt(input.due_at)
    const nextDue = explicitDue || addMonths(baseDate, months)
    const nextDueIso = nextDue.toISOString()
    const fingerprint = `${plan}:${amountCents}:${current?.id || 'new'}:${nextDueIso}`

    const recent = await findRecentSimilar(clientId, fingerprint)
    if (recent?.metadata) {
      await writeLog('RENEWAL_SKIPPED_RECENT_DUPLICATE', 'info', {
        client_id: clientId,
        message: 'Renovacao duplicada recente ignorada.',
        metadata: { idempotency_key: idempotencyKey, fingerprint, renewal_id: recent.metadata.renewal_id || null },
      })
      return {
        success: true,
        already_processed: true,
        code: 'RENEWAL_RECENT_DUPLICATE',
        idempotency_key: idempotencyKey,
        renewal: recent.metadata,
      }
    }

    const account = await accountContext(clientId)
    const now = new Date().toISOString()
    let renewalId = current?.id || ''
    const metadata = {
      ...safeMetadata(current?.metadata),
      renewed_by_painel1: true,
      idempotency_key: idempotencyKey,
      previous_due_at: current?.due_at || null,
      renewed_at: now,
      note: input.note || null,
    }

    if (current) {
      const { error: updateError } = await database
        .from('renewals')
        .update({
          account_id: current.account_id || account.account_id,
          slot_id: current.slot_id || account.slot_id,
          plan_key: plan,
          amount_cents: amountCents,
          status: 'applied',
          due_at: nextDueIso,
          paid_until: nextDueIso,
          confirmed_at: now,
          operator_ref: input.operator_ref || 'painel_web',
          metadata,
          updated_at: now,
        })
        .eq('id', current.id)

      if (updateError) throw new RenewalError(500, 'RENEWAL_UPDATE_FAILED', updateError.message)
    } else {
      const { data: inserted, error: insertError } = await database
        .from('renewals')
        .insert({
          client_id: clientId,
          account_id: account.account_id,
          slot_id: account.slot_id,
          plan_key: plan,
          amount_cents: amountCents,
          currency: 'BRL',
          status: 'applied',
          due_at: nextDueIso,
          paid_until: nextDueIso,
          confirmed_at: now,
          operator_ref: input.operator_ref || 'painel_web',
          metadata,
        })
        .select('id')
        .single()

      if (insertError) throw new RenewalError(500, 'RENEWAL_CREATE_FAILED', insertError.message)
      renewalId = (inserted as { id: string }).id
    }

    await Promise.all([
      database
        .from('clients')
        .update({
          legacy_metadata: {
            ...safeMetadata(client.legacy_metadata),
            latest_renewal_id: renewalId,
            renewal_due_at: nextDueIso,
            renewed_at: now,
          },
        })
        .eq('id', clientId),
      account.slot_id
        ? database.from('account_slots').update({ expires_at: nextDueIso }).eq('id', account.slot_id)
        : Promise.resolve({ error: null }),
    ])

    const eventPayload = {
      renewal_id: renewalId,
      previous_due_at: current?.due_at || null,
      new_due_at: nextDueIso,
      plan_key: plan,
      amount_cents: amountCents,
      idempotency_key: idempotencyKey,
      fingerprint,
    }

    const { error: eventError } = await database.from('pipeline_events').insert({
      entity_type: 'client',
      entity_id: clientId,
      event_type: 'renewal_applied',
      from_status: client.status,
      to_status: client.status,
      operator_ref: input.operator_ref || 'painel_web',
      payload: eventPayload,
    })
    if (eventError) throw new RenewalError(500, 'PIPELINE_EVENT_FAILED', eventError.message)

    await writeLog('RENEWAL_APPLIED', 'success', {
      client_id: clientId,
      account_id: account.account_id,
      message: `Renovacao aplicada para ${client.name || clientId}.`,
      metadata: eventPayload,
    })

    const dispatch = await dispatchRenewal({
      idempotencyKey,
      client,
      plan,
      amountCents,
      dueAt: nextDueIso,
      account,
    }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }))

    await writeLog('RENEWAL_DISPATCH_FINISHED', (dispatch as { ok?: boolean }).ok ? 'success' : 'warning', {
      client_id: clientId,
      account_id: account.account_id,
      message: 'Dispatch renewal_created finalizado.',
      metadata: { idempotency_key: idempotencyKey, dispatch },
    })

    return {
      success: true,
      code: 'RENEWAL_APPLIED',
      idempotency_key: idempotencyKey,
      client_id: clientId,
      client_name: client.name,
      renewal: {
        id: renewalId,
        previous_due_at: current?.due_at || null,
        due_at: nextDueIso,
        plan_key: plan,
        amount_cents: amountCents,
      },
      dispatch,
    }
  } catch (error) {
    const err = error instanceof RenewalError
      ? error
      : new RenewalError(500, 'RENEWAL_FAILED', error instanceof Error ? error.message : String(error))
    try {
      await writeLog('RENEWAL_FAILED', 'error', {
        client_id: clientId,
        message: err.message,
        metadata: { code: err.code, idempotency_key: idempotencyKey },
      })
    } catch {
      // Preserve original error.
    }
    throw err
  } finally {
    runningRenewals.delete(runningKey)
    runningRenewalClients.delete(clientId)
  }
}

export function renewalErrorResponse(error: unknown) {
  const err = error instanceof RenewalError
    ? error
    : new RenewalError(500, 'RENEWAL_FAILED', error instanceof Error ? error.message : String(error))

  return {
    status: err.status,
    body: {
      success: false,
      code: err.code,
      error: maskSensitiveText(err.message),
    },
  }
}
