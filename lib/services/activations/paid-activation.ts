import { maskSensitiveText } from '@/lib/services/masking'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type JsonRecord = Record<string, unknown>

type ActivationInput = {
  test_id?: string
  client_id?: string
  client?: {
    name?: string
    phone?: string
  }
  app_id?: string
  panel_id?: string
  plan_key?: string
  amount_cents?: number
  amount?: number
  due_at?: string
  account_id?: string
  slot_id?: string
  slot_number?: number
  force_new_account?: boolean
  create_new_account_confirmed?: boolean
  new_account?: {
    username?: string
    password_secret?: string
    provider?: string
    provider_code?: string
    panel_external_id?: string
    device_key?: string
    expires_at?: string
  }
  operator_ref?: string
}

type ClientRow = {
  id: string
  name: string | null
  phone_e164: string | null
  phone_raw: string | null
  status: string | null
  legacy_metadata: JsonRecord | null
}

type TestRow = {
  id: string
  client_id: string
  app_id: string | null
  panel_id: string | null
  account_id: string | null
  provider: string | null
  provider_code: string | null
  status: string | null
  expires_at: string | null
  legacy_metadata: JsonRecord | null
}

type AppRow = { id: string; key: string; name: string }
type PanelRow = { id: string; key: string; name: string }

type AccountRow = {
  id: string
  app_id: string
  panel_id: string | null
  username: string | null
  provider: string | null
  provider_code: string | null
  panel_external_id: string | null
  max_slots: number | null
  status: string | null
  expires_at: string | null
}

type SlotRow = {
  id: string
  account_id: string
  client_id: string | null
  slot_number: number
  status: string | null
  assigned_at: string | null
  expires_at: string | null
}

export type ActivationRecommendation = {
  recommended: boolean
  reason: string
  account_id: string | null
  account_label: string | null
  slot_id: string | null
  slot_number: number | null
  slot_label: string | null
  requires_new_account: boolean
  capacity: number
  app_id: string | null
  panel_id: string | null
}

type ActivationContext = {
  client: ClientRow
  test: TestRow | null
  app: AppRow
  panel: PanelRow | null
  plan_key: string
  amount_cents: number
  due_at: string
}

class ActivationError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function db() {
  const client = getSupabaseServerClient()
  if (!client) throw new ActivationError(500, 'SUPABASE_NOT_CONFIGURED', 'Supabase server env ausente.')
  return client
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

function amountToCents(input: ActivationInput): number {
  if (Number.isFinite(input.amount_cents)) return Math.round(Number(input.amount_cents))
  if (Number.isFinite(input.amount)) return Math.round(Number(input.amount) * 100)
  return 3500
}

function defaultDueAt(value?: string): string {
  if (value) {
    const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    const date = br ? new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00.000Z`) : new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  const date = new Date()
  date.setMonth(date.getMonth() + 1)
  return date.toISOString()
}

function panelCapacity(panel: PanelRow | null): number {
  const key = String(panel?.key || '').toLowerCase()
  const name = String(panel?.name || '').toLowerCase()
  if (key.includes('ninety') || name.includes('ninety')) return 1
  if (key.includes('cinemax') || name.includes('cinemax')) return 2
  if (key.includes('yellow') || key.includes('brasil') || name.includes('yellow') || name.includes('brasil')) return 2
  return 1
}

function accountLabel(account: AccountRow): string {
  return account.panel_external_id ? `#${account.panel_external_id}` : `#${account.id.slice(0, 4)}`
}

function slotLabel(slotNumber: number): string {
  return `Tela ${String(slotNumber).padStart(2, '0')}`
}

function safeMessage(message: string): string {
  return maskSensitiveText(message).slice(0, 800)
}

async function writeLog(event: string, level: 'info' | 'warning' | 'error' | 'success', payload: {
  client_id?: string | null
  test_id?: string | null
  account_id?: string | null
  message?: string
  metadata?: JsonRecord
}) {
  const database = db()
  const { error } = await database.from('logs').insert({
    scope: 'activation',
    level,
    event,
    client_id: payload.client_id || null,
    test_id: payload.test_id || null,
    account_id: payload.account_id || null,
    message: safeMessage(payload.message || event),
    metadata: payload.metadata || {},
  })
  if (error) throw new ActivationError(500, 'LOG_WRITE_FAILED', `Falha ao registrar log ${event}: ${error.message}`)
}

async function resolveContext(input: ActivationInput): Promise<ActivationContext> {
  const database = db()
  let test: TestRow | null = null
  let client: ClientRow | null = null

  if (input.test_id) {
    const { data, error } = await database
      .from('tests')
      .select('id,client_id,app_id,panel_id,account_id,provider,provider_code,status,expires_at,legacy_metadata')
      .eq('id', input.test_id)
      .maybeSingle()
    if (error) throw new ActivationError(500, 'TEST_LOOKUP_FAILED', error.message)
    if (!data) throw new ActivationError(404, 'TEST_NOT_FOUND', 'Teste nao encontrado.')
    test = data as TestRow
    if (['converted', 'cancelled', 'archived'].includes(String(test.status || ''))) {
      throw new ActivationError(409, 'TEST_NOT_ACTIVATABLE', 'Teste ja convertido, cancelado ou arquivado.')
    }
  }

  const clientId = input.client_id || test?.client_id
  if (clientId) {
    const { data, error } = await database
      .from('clients')
      .select('id,name,phone_e164,phone_raw,status,legacy_metadata')
      .eq('id', clientId)
      .maybeSingle()
    if (error) throw new ActivationError(500, 'CLIENT_LOOKUP_FAILED', error.message)
    if (!data) throw new ActivationError(404, 'CLIENT_NOT_FOUND', 'Cliente nao encontrado.')
    client = data as ClientRow
  } else {
    const name = String(input.client?.name || '').trim()
    const phone = String(input.client?.phone || '').trim()
    if (!name || !phone) {
      throw new ActivationError(400, 'CLIENT_REQUIRED', 'Informe test_id, client_id ou cliente manual com nome/telefone.')
    }
    const { data, error } = await database
      .from('clients')
      .insert({
        name,
        phone_e164: normalizePhone(phone),
        phone_raw: phone,
        status: 'lead',
        source: 'manual_paid_activation',
        legacy_metadata: { created_by_activation_endpoint: true },
      })
      .select('id,name,phone_e164,phone_raw,status,legacy_metadata')
      .single()
    if (error) throw new ActivationError(500, 'CLIENT_CREATE_FAILED', error.message)
    client = data as ClientRow
  }

  let accountDefaults: { app_id: string; panel_id: string | null } | null = null
  if ((!input.app_id || !input.panel_id) && input.account_id) {
    const { data: accountData, error: accountError } = await database
      .from('accounts')
      .select('app_id,panel_id')
      .eq('id', input.account_id)
      .maybeSingle()
    if (accountError) throw new ActivationError(500, 'ACCOUNT_LOOKUP_FAILED', accountError.message)
    if (accountData) accountDefaults = accountData as { app_id: string; panel_id: string | null }
  }

  const appId = input.app_id || test?.app_id || accountDefaults?.app_id
  if (!appId) throw new ActivationError(400, 'APP_REQUIRED', 'app_id e obrigatorio quando o teste nao informa app.')
  const { data: appData, error: appError } = await database.from('apps').select('id,key,name').eq('id', appId).maybeSingle()
  if (appError) throw new ActivationError(500, 'APP_LOOKUP_FAILED', appError.message)
  if (!appData) throw new ActivationError(404, 'APP_NOT_FOUND', 'App nao encontrado.')

  const panelId = input.panel_id || test?.panel_id || accountDefaults?.panel_id
  let panel: PanelRow | null = null
  if (panelId) {
    const { data: panelData, error: panelError } = await database.from('panels').select('id,key,name').eq('id', panelId).maybeSingle()
    if (panelError) throw new ActivationError(500, 'PANEL_LOOKUP_FAILED', panelError.message)
    if (!panelData) throw new ActivationError(404, 'PANEL_NOT_FOUND', 'Painel nao encontrado.')
    panel = panelData as PanelRow
  }

  return {
    client,
    test,
    app: appData as AppRow,
    panel,
    plan_key: String(input.plan_key || 'mensal').trim() || 'mensal',
    amount_cents: amountToCents(input),
    due_at: defaultDueAt(input.due_at || test?.expires_at || undefined),
  }
}

async function findFreeSlot(appId: string, panelId?: string | null, requested?: {
  account_id?: string
  slot_id?: string
  slot_number?: number
}): Promise<{ account: AccountRow; slot: SlotRow; capacity: number } | null> {
  const database = db()

  let query = database
    .from('accounts')
    .select('id,app_id,panel_id,username,provider,provider_code,panel_external_id,max_slots,status,expires_at')
    .eq('app_id', appId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (panelId) query = query.eq('panel_id', panelId)
  if (requested?.account_id) query = query.eq('id', requested.account_id)

  const { data: accountsData, error: accountsError } = await query
  if (accountsError) throw new ActivationError(500, 'ACCOUNT_LOOKUP_FAILED', accountsError.message)

  const accounts = (accountsData || []) as AccountRow[]
  if (!accounts.length) return null

  const accountIds = accounts.map((account) => account.id)
  let slotQuery = database
    .from('account_slots')
    .select('id,account_id,client_id,slot_number,status,assigned_at,expires_at')
    .in('account_id', accountIds)
    .order('slot_number', { ascending: true })

  if (requested?.slot_id) slotQuery = slotQuery.eq('id', requested.slot_id)
  if (requested?.slot_number) slotQuery = slotQuery.eq('slot_number', requested.slot_number)

  const { data: slotsData, error: slotsError } = await slotQuery
  if (slotsError) throw new ActivationError(500, 'SLOT_LOOKUP_FAILED', slotsError.message)

  const slots = ((slotsData || []) as SlotRow[]).filter((slot) =>
    !slot.client_id && ['free', 'released'].includes(String(slot.status || 'free'))
  )
  const accountById = new Map(accounts.map((account) => [account.id, account]))

  for (const slot of slots) {
    const account = accountById.get(slot.account_id)
    if (!account) continue
    const capacity = Math.max(Number(account.max_slots || 1), 1)
    if (slot.slot_number <= capacity) return { account, slot, capacity }
  }

  return null
}

function providerFromPanel(panel: PanelRow | null): string | null {
  const key = String(panel?.key || '').toLowerCase()
  if (key.includes('ninety')) return 'ninety'
  if (key.includes('yellow') || key.includes('brasil')) return 'yellow_box'
  if (key.includes('cinemax')) return 'cinemax'
  return key || null
}

async function createConfirmedNewAccount(context: ActivationContext, input: ActivationInput): Promise<{ account: AccountRow; slot: SlotRow; capacity: number }> {
  if (!input.create_new_account_confirmed) {
    throw new ActivationError(409, 'NO_FREE_SLOT', 'Nenhuma vaga livre compativel encontrada. Criacao de nova conta exige confirmacao do operador.')
  }

  const username = String(input.new_account?.username || '').trim()
  const password = String(input.new_account?.password_secret || '').trim()
  if (!username || !password) {
    throw new ActivationError(400, 'NEW_ACCOUNT_CREDENTIALS_REQUIRED', 'Para criar nova conta, informe usuario e senha da conta paga.')
  }

  const database = db()
  const capacity = panelCapacity(context.panel)
  const now = new Date().toISOString()
  const { data: accountData, error: accountError } = await database
    .from('accounts')
    .insert({
      client_id: null,
      source_test_id: context.test?.id || null,
      app_id: context.app.id,
      panel_id: context.panel?.id || null,
      username,
      password_secret: password,
      device_key: input.new_account?.device_key || null,
      provider: input.new_account?.provider || providerFromPanel(context.panel),
      provider_code: input.new_account?.provider_code || context.test?.provider_code || null,
      panel_external_id: input.new_account?.panel_external_id || null,
      max_slots: capacity,
      status: 'active',
      activated_at: now,
      expires_at: input.new_account?.expires_at || context.due_at,
      legacy_metadata: {
        created_by_paid_activation: true,
        test_id: context.test?.id || null,
      },
    })
    .select('id,app_id,panel_id,username,provider,provider_code,panel_external_id,max_slots,status,expires_at')
    .single()

  if (accountError) throw new ActivationError(500, 'ACCOUNT_CREATE_FAILED', accountError.message)
  const account = accountData as AccountRow

  const slotRows = Array.from({ length: capacity }, (_, index) => ({
    account_id: account.id,
    slot_number: index + 1,
    status: 'free',
    expires_at: context.due_at,
    metadata: { created_by_paid_activation: true },
  }))

  const { data: slotsData, error: slotsError } = await database
    .from('account_slots')
    .insert(slotRows)
    .select('id,account_id,client_id,slot_number,status,assigned_at,expires_at')
    .order('slot_number', { ascending: true })

  if (slotsError) {
    await database.from('accounts').delete().eq('id', account.id)
    throw new ActivationError(500, 'ACCOUNT_SLOTS_CREATE_FAILED', slotsError.message)
  }

  const slot = ((slotsData || []) as SlotRow[]).find((row) => row.slot_number === 1)
  if (!slot) {
    await database.from('accounts').delete().eq('id', account.id)
    throw new ActivationError(500, 'ACCOUNT_SLOT_MISSING', 'Conta criada sem slot inicial.')
  }

  return { account, slot, capacity }
}

export async function getActivationRecommendation(input: {
  client_id?: string
  test_id?: string
  app_id?: string
  panel_id?: string
  account_id?: string
  slot_id?: string
  slot_number?: number
}): Promise<ActivationRecommendation> {
  const context = await resolveContext({
    client_id: input.client_id,
    test_id: input.test_id,
    app_id: input.app_id,
    panel_id: input.panel_id,
    account_id: input.account_id,
  })
  const found = await findFreeSlot(context.app.id, context.panel?.id || null, input)
  const capacity = panelCapacity(context.panel)

  if (!found) {
    await writeLog('ACTIVATION_RECOMMENDATION_FOUND', 'warning', {
      client_id: context.client.id,
      test_id: context.test?.id || null,
      message: 'Nenhuma vaga livre compativel encontrada.',
      metadata: {
        app_id: context.app.id,
        panel_id: context.panel?.id || null,
        requires_new_account: true,
      },
    })
    return {
      recommended: false,
      reason: 'Nenhuma vaga livre. Sera necessario criar nova conta.',
      account_id: null,
      account_label: null,
      slot_id: null,
      slot_number: null,
      slot_label: null,
      requires_new_account: true,
      capacity,
      app_id: context.app.id,
      panel_id: context.panel?.id || null,
    }
  }

  const reason = `Usar vaga livre na ${slotLabel(found.slot.slot_number)} da conta ${accountLabel(found.account)} economiza credito`
  await writeLog('ACTIVATION_RECOMMENDATION_FOUND', 'info', {
    client_id: context.client.id,
    test_id: context.test?.id || null,
    account_id: found.account.id,
    message: reason,
    metadata: {
      app_id: context.app.id,
      panel_id: context.panel?.id || null,
      slot_id: found.slot.id,
      slot_number: found.slot.slot_number,
      requires_new_account: false,
    },
  })

  return {
    recommended: true,
    reason,
    account_id: found.account.id,
    account_label: accountLabel(found.account),
    slot_id: found.slot.id,
    slot_number: found.slot.slot_number,
    slot_label: slotLabel(found.slot.slot_number),
    requires_new_account: false,
    capacity: found.capacity,
    app_id: context.app.id,
    panel_id: context.panel?.id || null,
  }
}

async function createPipelineEvent(eventType: string, payload: {
  entity_type: string
  entity_id: string
  from_status?: string | null
  to_status?: string | null
  operator_ref?: string | null
  payload: JsonRecord
}) {
  const database = db()
  const { error } = await database.from('pipeline_events').insert({
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    event_type: eventType,
    from_status: payload.from_status || null,
    to_status: payload.to_status || null,
    operator_ref: payload.operator_ref || null,
    payload: payload.payload,
  })
  if (error) throw new ActivationError(500, 'PIPELINE_EVENT_FAILED', error.message)
}

export async function activatePaidClient(input: ActivationInput) {
  const database = db()
  const touched: {
    slot?: { id: string; previous_status: string | null; previous_client_id: string | null }
    client?: { id: string; previous_status: string | null }
    renewal_id?: string
    test?: { id: string; previous_status: string | null; previous_account_id: string | null }
    account_id?: string
    created_account_id?: string
  } = {}

  try {
    const context = await resolveContext(input)

    if (context.client.status === 'active') {
      throw new ActivationError(409, 'CLIENT_ALREADY_ACTIVE', 'Cliente ja esta ativo.')
    }

    let requestedSlot = await findFreeSlot(context.app.id, context.panel?.id || null, {
      account_id: input.account_id,
      slot_id: input.slot_id,
      slot_number: input.slot_number,
    })

    if (!requestedSlot) {
      requestedSlot = await createConfirmedNewAccount(context, input)
      touched.created_account_id = requestedSlot.account.id
    }

    const { account, slot } = requestedSlot
    const now = new Date().toISOString()

    const { data: occupiedSlot, error: occupyError } = await database
      .from('account_slots')
      .update({
        client_id: context.client.id,
        status: 'occupied',
        assigned_at: now,
        released_at: null,
        expires_at: context.due_at,
        metadata: {
          paid_activation: true,
          test_id: context.test?.id || null,
          app_id: context.app.id,
          panel_id: context.panel?.id || null,
          plan_key: context.plan_key,
        },
      })
      .eq('id', slot.id)
      .is('client_id', null)
      .in('status', ['free', 'released'])
      .select('id,account_id,client_id,slot_number,status,assigned_at,expires_at')
      .maybeSingle()

    if (occupyError) throw new ActivationError(500, 'SLOT_OCCUPY_FAILED', occupyError.message)
    if (!occupiedSlot) throw new ActivationError(409, 'SLOT_ALREADY_OCCUPIED', 'Slot ja foi ocupado por outro cliente.')

    touched.slot = { id: slot.id, previous_status: slot.status, previous_client_id: slot.client_id }
    touched.account_id = account.id

    await writeLog('ACCOUNT_SLOT_USED', 'success', {
      client_id: context.client.id,
      test_id: context.test?.id || null,
      account_id: account.id,
      message: `${slotLabel(slot.slot_number)} ocupada na conta ${accountLabel(account)}.`,
      metadata: { slot_id: slot.id, slot_number: slot.slot_number },
    })

    const { error: clientError } = await database
      .from('clients')
      .update({
        status: 'active',
        legacy_metadata: {
          ...(context.client.legacy_metadata || {}),
          activated_from_test_id: context.test?.id || null,
          active_account_id: account.id,
          active_slot_id: slot.id,
          paid_activation_at: now,
        },
      })
      .eq('id', context.client.id)

    if (clientError) throw new ActivationError(500, 'CLIENT_UPDATE_FAILED', clientError.message)
    touched.client = { id: context.client.id, previous_status: context.client.status }

    await writeLog('CLIENT_ACTIVATED', 'success', {
      client_id: context.client.id,
      test_id: context.test?.id || null,
      account_id: account.id,
      message: `Cliente ${context.client.name || context.client.id} ativado como pago.`,
      metadata: { slot_id: slot.id, plan_key: context.plan_key, due_at: context.due_at },
    })

    if (context.test) {
      const { error: testError } = await database
        .from('tests')
        .update({
          status: 'converted',
          account_id: account.id,
          legacy_metadata: {
            ...(context.test.legacy_metadata || {}),
            converted_to_paid_at: now,
            active_slot_id: slot.id,
            paid_activation: true,
          },
        })
        .eq('id', context.test.id)

      if (testError) throw new ActivationError(500, 'TEST_UPDATE_FAILED', testError.message)
      touched.test = { id: context.test.id, previous_status: context.test.status, previous_account_id: context.test.account_id }

      await writeLog('TEST_CONVERTED', 'success', {
        client_id: context.client.id,
        test_id: context.test.id,
        account_id: account.id,
        message: `Teste ${context.test.id} convertido em cliente pago.`,
        metadata: { slot_id: slot.id },
      })
    }

    const { data: renewal, error: renewalError } = await database
      .from('renewals')
      .insert({
        client_id: context.client.id,
        account_id: account.id,
        slot_id: slot.id,
        plan_key: context.plan_key,
        amount_cents: context.amount_cents,
        currency: 'BRL',
        status: 'applied',
        due_at: context.due_at,
        paid_until: context.due_at,
        confirmed_at: now,
        operator_ref: input.operator_ref || null,
        metadata: {
          paid_activation: true,
          test_id: context.test?.id || null,
          app_id: context.app.id,
          panel_id: context.panel?.id || null,
        },
      })
      .select('id,due_at,plan_key,amount_cents,status')
      .single()

    if (renewalError) throw new ActivationError(500, 'RENEWAL_CREATE_FAILED', renewalError.message)
    touched.renewal_id = renewal.id

    await writeLog('RENEWAL_CREATED', 'success', {
      client_id: context.client.id,
      test_id: context.test?.id || null,
      account_id: account.id,
      message: `Renovacao criada para ${context.due_at}.`,
      metadata: { renewal_id: renewal.id, slot_id: slot.id, amount_cents: context.amount_cents },
    })

    await createPipelineEvent('paid_activation_completed', {
      entity_type: 'client',
      entity_id: context.client.id,
      from_status: context.client.status,
      to_status: 'active',
      operator_ref: input.operator_ref || null,
      payload: {
        test_id: context.test?.id || null,
        account_id: account.id,
        slot_id: slot.id,
        app_id: context.app.id,
        panel_id: context.panel?.id || null,
        renewal_id: renewal.id,
        reused_existing_slot: true,
      },
    })

    return {
      success: true,
      activation: {
        client_id: context.client.id,
        client_name: context.client.name,
        test_id: context.test?.id || null,
        account_id: account.id,
        account_label: accountLabel(account),
        slot_id: slot.id,
        slot_number: slot.slot_number,
        slot_label: slotLabel(slot.slot_number),
        renewal_id: renewal.id,
        plan_key: context.plan_key,
        amount_cents: context.amount_cents,
        due_at: context.due_at,
        reused_existing_slot: true,
      },
    }
  } catch (error) {
    if (touched.renewal_id) {
      await database.from('renewals').delete().eq('id', touched.renewal_id)
    }
    if (touched.test) {
      await database.from('tests').update({ status: touched.test.previous_status, account_id: touched.test.previous_account_id }).eq('id', touched.test.id)
    }
    if (touched.client) {
      await database.from('clients').update({ status: touched.client.previous_status }).eq('id', touched.client.id)
    }
    if (touched.slot) {
      await database
        .from('account_slots')
        .update({
          client_id: touched.slot.previous_client_id,
          status: touched.slot.previous_status || 'free',
          assigned_at: null,
          expires_at: null,
        })
        .eq('id', touched.slot.id)
    }
    if (touched.created_account_id) {
      await database.from('accounts').delete().eq('id', touched.created_account_id)
    }

    const err = error instanceof ActivationError
      ? error
      : new ActivationError(500, 'ACTIVATION_FAILED', error instanceof Error ? error.message : String(error))

    try {
      await writeLog('ACTIVATION_FAILED', 'error', {
        client_id: input.client_id || null,
        test_id: input.test_id || null,
        account_id: touched.account_id || input.account_id || null,
        message: err.message,
        metadata: { code: err.code },
      })
    } catch {
      // If logging itself fails, preserve the original activation error.
    }

    throw err
  }
}

export function activationErrorResponse(error: unknown) {
  const err = error instanceof ActivationError
    ? error
    : new ActivationError(500, 'ACTIVATION_FAILED', error instanceof Error ? error.message : String(error))

  return {
    status: err.status,
    body: {
      success: false,
      code: err.code,
      error: safeMessage(err.message),
    },
  }
}
