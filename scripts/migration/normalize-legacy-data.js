#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.resolve(ROOT, process.env.MIGRATION_OUTPUT_DIR || '.migration-output')

const STATUS_CLIENT = new Set(['ativo', 'active'])
const STATUS_ARCHIVED = new Set(['archived', 'arquivado', 'archived_duplicate', 'archived_manual'])
const STATUS_ERROR = new Set(['erro', 'error', 'failed', 'xcloud_pending'])

function read(file, fallback) {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function write(name, data) {
  fs.mkdirSync(OUT_DIR, { recursive: true, mode: 0o700 })
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2), { mode: 0o600 })
}

function id(prefix, seed) {
  return `${prefix}_${crypto.createHash('sha1').update(String(seed || prefix)).digest('hex').slice(0, 24)}`
}

function metadata(row) {
  return row && row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 11) return `55${digits}`
  if (digits.length === 13 && digits.startsWith('55')) return digits
  return digits
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function parseDate(...values) {
  for (const value of values) {
    if (!value) continue
    const raw = String(value).trim()
    if (!raw) continue
    const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/)
    if (br) {
      const [, d, m, y, hh = '00', mm = '00', ss = '00'] = br
      return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}-03:00`).toISOString()
    }
    const date = new Date(raw)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  return null
}

function amountCents(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(String(value).replace(/[^\d,.-]/g, '').replace(',', '.'))
  return Number.isFinite(number) ? Math.round(number * 100) : null
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return '-'
  if (digits.length <= 6) return '***'
  return `${digits.slice(0, 4)}***${digits.slice(-2)}`
}

function maskText(value) {
  const text = String(value || '').trim()
  if (!text) return '-'
  return text.length <= 4 ? '***' : `${text.slice(0, 2)}***${text.slice(-2)}`
}

function getUsername(row) {
  const m = metadata(row)
  return String(row.iptv_username || m.username || '').trim() || null
}

function getPassword(row) {
  const m = metadata(row)
  return String(row.iptv_password || m.password || '').trim() || null
}

function getM3u(row) {
  const m = metadata(row)
  return String(row.m3u_url || m.m3uUrl || '').trim() || null
}

function getHls(row) {
  const m = metadata(row)
  return String(m.hlsUrl || '').trim() || null
}

function getDeviceKey(row) {
  const m = metadata(row)
  return String(row.device_key || m.deviceKey || '').trim() || null
}

function isXcloud(row) {
  const m = metadata(row)
  return /xcloud/i.test(String(row.app_name || m.app || m.appName || ''))
}

function credentialReasons(row) {
  const reasons = []
  if (getUsername(row)) reasons.push('username')
  if (getPassword(row)) reasons.push('password')
  if (getM3u(row)) reasons.push('m3u')
  if (getHls(row)) reasons.push('hls')
  if (isXcloud(row) && getDeviceKey(row)) reasons.push('xcloud_device_key')
  return reasons
}

function hasTechnicalCredential(row) {
  return credentialReasons(row).length > 0
}

function hasCompleteTechnicalCredential(row) {
  const username = Boolean(getUsername(row))
  const password = Boolean(getPassword(row))
  const transport = Boolean(getM3u(row) || getHls(row) || (isXcloud(row) && getDeviceKey(row)))
  return username && password && transport
}

function shouldCreateAccount(row) {
  const status = mapClientStatus(row)
  if ((status === 'archived' || status === 'error') && !hasCompleteTechnicalCredential(row)) return false
  return hasTechnicalCredential(row)
}

function accountCreationReason(row) {
  const status = mapClientStatus(row)
  if ((status === 'archived' || status === 'error') && !hasCompleteTechnicalCredential(row)) {
    return 'archived_error_without_complete_credentials'
  }
  if (!hasTechnicalCredential(row)) return 'no_technical_credentials'
  return 'eligible'
}

function dueDate(row) {
  const m = metadata(row)
  return parseDate(m.planDueAt, m.dueAt, m.expiresAt, m.test_expires_at)
}

function mapClientStatus(row) {
  const m = metadata(row)
  const raw = String(m.status || row.status || row.source || '').toLowerCase()
  if (STATUS_ARCHIVED.has(raw) || String(row.source || '').startsWith('archived')) return 'archived'
  if (STATUS_ERROR.has(raw)) return 'error'
  if (STATUS_CLIENT.has(raw) || row.source === 'client_active') return 'active'
  if (raw === 'teste' || String(row.source || '').includes('test')) return 'test_active'
  return 'lead'
}

function clientScore(row) {
  const status = mapClientStatus(row)
  let score = 0
  if (status === 'active') score += 100
  if (status === 'test_active') score += 70
  if (dueDate(row)) score += 35
  if (getUsername(row) && getPassword(row)) score += 25
  if (getM3u(row) || getHls(row) || getDeviceKey(row)) score += 15
  if (normalizePhone(row.phone || metadata(row).normalizedPhone || metadata(row).phone)) score += 10
  return score
}

function duplicateGroupManualReviewNeeded(rows) {
  if (rows.length >= 20) return true
  const statuses = new Set(rows.map((row) => mapClientStatus(row)))
  return statuses.has('archived') || statuses.has('error')
}

function buildDuplicateLookups(duplicateReport) {
  const phoneGroups = new Map((duplicateReport.phone_groups || []).map((group) => [group.key_raw, group]))
  const usernameGroups = new Map((duplicateReport.username_groups || []).map((group) => [group.key_raw, group]))
  return { phoneGroups, usernameGroups }
}

function isDuplicateCritical(row, duplicateLookups) {
  const phone = normalizePhone(row.phone_e164 || row.phone || metadata(row).normalizedPhone || metadata(row).phone)
  const username = getUsername(row) || null
  const phoneGroup = phone ? duplicateLookups.phoneGroups.get(phone) : null
  const userGroup = username ? duplicateLookups.usernameGroups.get(username) : null
  const group = phoneGroup || userGroup
  if (!group) return null
  return {
    group,
    type: phoneGroup ? 'phone' : 'username',
  }
}

function isSafeClientRow(client, sourceRow, duplicateLookups) {
  const duplicate = isDuplicateCritical(sourceRow || client, duplicateLookups)
  const status = client.status
  const phoneValid = Boolean(client.phone_e164)
  const nameOrUsername = Boolean((client.name && String(client.name).trim()) || getUsername(sourceRow || client))
  const dueReliable = Boolean(dueDate(sourceRow || client) || client.legacy_metadata?.legacy?.metadata?.dueAt || client.legacy_metadata?.legacy?.metadata?.planDueAt)
  return {
    safe: !duplicate && status === 'active' && phoneValid && nameOrUsername && dueReliable,
    duplicate,
    phoneValid,
    nameOrUsername,
    dueReliable,
  }
}

function classifyClientRow(client, sourceRow, duplicateLookups) {
  const duplicate = isDuplicateCritical(sourceRow || client, duplicateLookups)
  if (!client.phone_e164) return { classification: 'quarantine_missing_phone', reason: 'missing_phone' }
  if (duplicate) {
    const reason = duplicate.group.manual_review_required ? 'admin_fallback' : 'duplicate_group'
    return {
      classification: duplicate.group.manual_review_required ? 'quarantine_duplicate/admin_fallback' : 'quarantine_duplicate',
      reason,
    }
  }
  const safe = isSafeClientRow(client, sourceRow, duplicateLookups)
  if (safe.safe) return { classification: 'import_safe', reason: 'client_safe' }
  if (client.status === 'archived' || client.status === 'error') return { classification: 'history_only', reason: `status_${client.status}` }
  return { classification: 'quarantine_duplicate', reason: 'not_safe_enough' }
}

function classifyTestRow(test, client, sourceRow, duplicateLookups) {
  if (test.status === 'active' && client && classifyClientRow(client, sourceRow, duplicateLookups).classification === 'import_safe') {
    return { classification: 'history_only', reason: 'tests_not_in_safe_only' }
  }
  return { classification: 'history_only', reason: `test_${test.status || 'history_only'}` }
}

function classifyAccountRow(account, client, sourceRow, duplicateLookups) {
  const duplicate = isDuplicateCritical(sourceRow || client || account, duplicateLookups)
  const completeCredentials = Boolean(account.username && (account.password_secret || account.m3u_url_secret || account.hls_url_secret || account.device_key))
  const safeClient = client ? classifyClientRow(client, sourceRow, duplicateLookups).classification === 'import_safe' : false
  if (duplicate) return { classification: 'quarantine_duplicate', reason: duplicate.group.manual_review_required ? 'admin_fallback' : 'duplicate_group' }
  if ((account.status === 'archived' || account.status === 'error') && !completeCredentials) {
    return { classification: 'history_only', reason: `account_${account.status}_without_complete_credentials` }
  }
  if (account.status === 'active' && completeCredentials && safeClient) {
    return { classification: 'import_safe', reason: 'account_safe' }
  }
  if (!completeCredentials) {
    return { classification: 'quarantine_suspicious_account', reason: 'missing_complete_credentials' }
  }
  return { classification: 'history_only', reason: 'account_history_only' }
}

function classifyRenewalRow(renewal, client, sourceRow, duplicateLookups) {
  const clientClass = classifyClientRow(client, sourceRow, duplicateLookups)
  if (renewal.status === 'cancelled') return { classification: 'history_only', reason: 'cancelled' }
  if (clientClass.classification === 'import_safe' && renewal.due_at) {
    return { classification: 'import_safe', reason: 'renewal_safe' }
  }
  return { classification: 'history_only', reason: 'renewal_history_only' }
}

function classifyPaymentRow(payment, client, sourceRow, duplicateLookups) {
  const clientClass = classifyClientRow(client, sourceRow, duplicateLookups)
  if (clientClass.classification === 'import_safe' && payment.status === 'paid') {
    return { classification: 'import_safe', reason: 'payment_safe' }
  }
  return { classification: 'history_only', reason: 'payment_history_only' }
}

function buildLegacyIndexes(oldClients, normalizedClients) {
  const byLegacyId = new Map()
  const byPhone = new Map()
  const byUsername = new Map()
  const byOrder = new Map()
  const byNamePhone = new Map()
  const clientByLegacy = new Map(normalizedClients.map((client) => [client.legacy_id, client]))

  for (const row of oldClients) {
    const m = metadata(row)
    const legacyId = String(row.id || '')
    const normalized = clientByLegacy.get(legacyId)
    if (!normalized) continue
    byLegacyId.set(legacyId, normalized)
    const phone = normalizePhone(row.phone || m.normalizedPhone || m.phone)
    const username = getUsername(row)
    const orderId = String(m.orderId || m.pedido || m.order_id || '').trim()
    const name = normalizeText(row.name || m.clientName || m.name)
    if (phone) addIndex(byPhone, phone, normalized)
    if (username) addIndex(byUsername, username, normalized)
    if (orderId) addIndex(byOrder, orderId, normalized)
    if (name && phone) addIndex(byNamePhone, `${name}|${phone}`, normalized)
  }
  return { byLegacyId, byPhone, byUsername, byOrder, byNamePhone }
}

function addIndex(map, key, value) {
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(value)
}

function firstIndex(map, key) {
  if (!key) return null
  const values = map.get(key)
  return values && values.length ? values[0] : null
}

function matchReminder(reminder, indexes) {
  const m = metadata(reminder)
  const candidates = [
    ['legacy_id', String(m.client_id || m.clientId || reminder.client_id || '').trim(), indexes.byLegacyId],
    ['phone', normalizePhone(reminder.phone || m.phone || m.normalizedPhone || reminder.identifier), indexes.byPhone],
    ['order', String(m.orderId || m.pedido || reminder.order_id || '').trim(), indexes.byOrder],
    ['username', String(m.username || m.iptv_username || reminder.identifier || '').trim(), indexes.byUsername],
  ]
  const name = normalizeText(m.clientName || m.name || reminder.client_name)
  const phone = normalizePhone(m.phone || m.normalizedPhone || reminder.phone)
  if (name && phone) candidates.push(['name_phone', `${name}|${phone}`, indexes.byNamePhone])

  for (const [method, key, index] of candidates) {
    const matched = firstIndex(index, key)
    if (matched) return { matched, method }
  }
  return { matched: null, method: 'no_match' }
}

function groupDuplicateRows(rows, getKey) {
  const groups = new Map()
  for (const row of rows) {
    const key = getKey(row)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.entries()].filter(([, items]) => items.length > 1)
}

function chooseCanonical(rows) {
  return rows.slice().sort((a, b) => {
    const score = clientScore(b) - clientScore(a)
    if (score) return score
    return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''))
  })[0]
}

function explainLargeDuplicateGroup(rows) {
  const sources = {}
  const statuses = {}
  for (const row of rows) {
    sources[row.source || 'empty'] = (sources[row.source || 'empty'] || 0) + 1
    statuses[mapClientStatus(row)] = (statuses[mapClientStatus(row)] || 0) + 1
  }
  return {
    explanation: 'Grupo grande normalmente indica telefone administrativo, teste repetido, cliente sem telefone real reaproveitando fallback ou registros legados sem normalizacao consistente.',
    sources,
    statuses,
  }
}

function main() {
  const legacy = read(path.join(OUT_DIR, 'legacy-supabase.json'), { tables: {} })
  const local = read(path.join(OUT_DIR, 'local-json.json'), { files: {} })
  const oldClients = legacy.tables.clients || []
  const reminders = legacy.tables.reminders || []
  const sales = legacy.tables.sales || []
  const metaEvents = legacy.tables.meta_conversion_events || []
  const sourceByLegacyId = new Map(oldClients.map((row) => [String(row.id || ''), row]))

  const clients = []
  const tests = []
  const accounts = []
  const accountSlots = []
  const renewals = []
  const payments = []
  const problems = []
  const messages = []
  const pipelineEvents = []
  const logs = []
  const accountCriteria = {}
  const reminderOrphans = []
  const welcomeOrphans = []

  for (const row of oldClients) {
    const m = metadata(row)
    const clientId = id('client', row.id || `${row.chat_id}:${row.user_id}:${row.created_at}`)
    const phone = normalizePhone(row.phone || m.normalizedPhone || m.phone)
    const status = mapClientStatus(row)
    const appName = row.app_name || m.app || m.appName || null
    const dueAt = dueDate(row)
    const reasons = credentialReasons(row)

    clients.push({
      id: clientId,
      legacy_id: String(row.id || ''),
      name: row.name || m.clientName || m.name || null,
      phone_e164: phone,
      phone_raw: row.phone || m.phone || null,
      telegram_chat_id: row.chat_id || null,
      telegram_user_id: row.user_id || null,
      whatsapp_jid: phone ? `${phone}@s.whatsapp.net` : null,
      status,
      source: row.source || null,
      duplicate_of: null,
      archived_reason: status === 'archived' ? String(row.source || m.status || 'legacy_archived') : null,
      notes: null,
      legacy_metadata: {
        legacy_table: 'clients',
        migration_notes: accountCreationReason(row) === 'eligible'
          ? []
          : [accountCreationReason(row)],
        legacy: row,
      },
      created_at: parseDate(row.created_at) || new Date().toISOString(),
      updated_at: parseDate(row.updated_at) || parseDate(row.created_at) || new Date().toISOString(),
    })

    const accountLike = shouldCreateAccount(row)
    const testLike = status === 'test_active' || String(row.source || '').includes('test') || m.test_expires_at

    if (testLike) {
      const testId = id('test', row.id || clientId)
      tests.push({
        id: testId,
        client_id: clientId,
        app_key: appName,
        panel_key: m.provider || m.painelLabel || null,
        account_id: accountLike ? id('account', row.id || clientId) : null,
        device_type: m.deviceType || null,
        device_key: getDeviceKey(row),
        provider: m.provider || m.painelLabel || null,
        provider_code: m.providerCode || null,
        status: status === 'error'
          ? 'failed'
          : status === 'archived'
            ? 'archived'
            : (dueAt && new Date(dueAt).getTime() < Date.now() ? 'expired' : 'active'),
        source: row.source || 'legacy',
        requested_at: parseDate(row.created_at) || new Date().toISOString(),
        activated_at: parseDate(m.activatedAt, row.created_at),
        expires_at: dueAt,
        failed_at: status === 'error' ? parseDate(row.updated_at) : null,
        failure_reason: status === 'error' ? (m.error || m.status || 'legacy_error') : null,
        legacy_metadata: { legacy_client_id: row.id, legacy: row },
      })
      const testRecord = tests[tests.length - 1]
    }

    if (accountLike) {
      const accountId = id('account', row.id || clientId)
      const maxSlots = String(m.provider || m.painelLabel || '').toLowerCase().includes('yellow') ? 2 : 1
      for (const reason of reasons) accountCriteria[reason] = (accountCriteria[reason] || 0) + 1
      accounts.push({
        id: accountId,
        client_id: clientId,
        source_test_id: testLike ? id('test', row.id || clientId) : null,
        app_key: appName,
        panel_key: m.provider || m.painelLabel || null,
        username: getUsername(row),
        password_secret: getPassword(row),
        m3u_url_secret: getM3u(row),
        hls_url_secret: getHls(row),
        device_key: getDeviceKey(row),
        provider: m.provider || m.painelLabel || null,
        provider_code: m.providerCode || null,
        panel_external_id: m.orderId || null,
        max_slots: maxSlots,
        status: status === 'active' || status === 'test_active' ? 'active' : (status === 'error' ? 'error' : 'expired'),
        activated_at: parseDate(m.activatedAt, row.created_at),
        expires_at: dueAt,
        legacy_metadata: { legacy_client_id: row.id, credential_reasons: reasons, legacy: row },
      })
      for (let slot = 1; slot <= maxSlots; slot++) {
        accountSlots.push({
          id: id('slot', `${accountId}:${slot}`),
          account_id: accountId,
          client_id: slot === 1 ? clientId : null,
          slot_number: slot,
          status: slot === 1 ? 'occupied' : 'free',
          device_key: slot === 1 ? getDeviceKey(row) : null,
          assigned_at: slot === 1 ? parseDate(row.created_at) : null,
          released_at: null,
          expires_at: dueAt,
          metadata: {},
        })
      }
    }

    if (status === 'error') {
      problems.push({
        id: id('problem', row.id || clientId),
        client_id: clientId,
        account_id: accountLike ? id('account', row.id || clientId) : null,
        test_id: testLike ? id('test', row.id || clientId) : null,
        type: 'legacy_error',
        status: 'open',
        title: 'Erro legado',
        description: String(m.error || m.status || row.source || 'Registro legado com erro'),
        resolution: null,
        opened_at: parseDate(row.updated_at, row.created_at) || new Date().toISOString(),
        closed_at: null,
        metadata: { legacy_client_id: row.id },
      })
    }

    pipelineEvents.push({
      id: id('event', `client:${clientId}:imported`),
      entity_type: 'client',
      entity_id: clientId,
      event_type: 'legacy_import_preview',
      from_status: null,
      to_status: status,
      operator_ref: 'migration_dry_run',
      integration_id: null,
      payload: { legacy_client_id: row.id, source: row.source || null },
    })
  }

  const clientById = new Map(clients.map((client) => [client.id, client]))
  const indexes = buildLegacyIndexes(oldClients, clients)
  const duplicateReport = buildDuplicateReport(oldClients)
  const duplicateLookups = buildDuplicateLookups(duplicateReport)
  const canonicalByPhone = Object.fromEntries(duplicateReport.phone_groups.map((group) => [group.key_raw, group.canonical_legacy_id]))
  const canonicalByUsername = Object.fromEntries(duplicateReport.username_groups.map((group) => [group.key_raw, group.canonical_legacy_id]))

  for (const client of clients) {
    const source = sourceByLegacyId.get(client.legacy_id)
    if (!source) continue
    const phoneKey = normalizePhone(source.phone || metadata(source).normalizedPhone || metadata(source).phone)
    const userKey = getUsername(source)
    const canonicalLegacyId = canonicalByPhone[phoneKey] || canonicalByUsername[userKey]
    if (canonicalLegacyId && String(canonicalLegacyId) !== client.legacy_id) {
      client.status = 'duplicate'
      client.duplicate_of = id('client', canonicalLegacyId)
    }
    const classification = classifyClientRow(client, source, duplicateLookups)
    client.migration_classification = classification.classification
    client.migration_quarantine_reason = classification.reason
  }

  for (const test of tests) {
    const client = clientById.get(test.client_id)
    const source = client ? sourceByLegacyId.get(client.legacy_id) : null
    const classification = classifyTestRow(test, client, source, duplicateLookups)
    test.migration_classification = classification.classification
    test.migration_quarantine_reason = classification.reason
  }

  for (const account of accounts) {
    const client = clientById.get(account.client_id)
    const source = client ? sourceByLegacyId.get(client.legacy_id) : null
    const classification = classifyAccountRow(account, client, source, duplicateLookups)
    account.migration_classification = classification.classification
    account.migration_quarantine_reason = classification.reason
  }

  for (const reminder of reminders) {
    const m = metadata(reminder)
    if (String(reminder.kind || m.kind || '').toLowerCase() !== 'client') {
      reminderOrphans.push(orphanReminder(reminder, 'kind_not_client'))
      continue
    }
    const { matched, method } = matchReminder(reminder, indexes)
    if (!matched) {
      reminderOrphans.push(orphanReminder(reminder, 'no_client_match'))
      continue
    }
    renewals.push({
      id: id('renewal', reminder.id || `${matched.id}:${reminder.due_at}`),
      client_id: matched.id,
      account_id: null,
      slot_id: null,
      plan_key: reminder.plan || m.plan || 'mensal',
      amount_cents: amountCents(m.value || m.amount || m.price),
      currency: 'BRL',
      status: reminder.status === 'cancelled' ? 'cancelled' : (new Date(parseDate(reminder.due_at) || 0).getTime() < Date.now() ? 'overdue' : 'pending_payment'),
      due_at: parseDate(reminder.due_at),
      paid_until: parseDate(m.paid_until || m.planDueAt),
      confirmed_at: parseDate(reminder.notified_at),
      operator_ref: null,
      metadata: { legacy_reminder_id: reminder.id, match_method: method, legacy: reminder },
    })
  }

  for (const sale of sales) {
    const m = metadata(sale)
    const phone = normalizePhone(sale.phone || m.phone || m.normalizedPhone)
    const matched = clients.find((client) => client.phone_e164 === phone) || clients.find((client) => client.legacy_id === String(sale.client_id || ''))
    if (!matched) continue
    payments.push({
      id: id('payment', sale.id || `${matched.id}:${sale.created_at}`),
      client_id: matched.id,
      renewal_id: null,
      integration_id: null,
      external_id: sale.external_id || sale.order_id || m.orderId || null,
      method: sale.method || m.method || 'legacy',
      amount_cents: amountCents(sale.amount || sale.value || m.amount || m.value) || 0,
      currency: sale.currency || 'BRL',
      status: 'paid',
      paid_at: parseDate(sale.paid_at, sale.created_at),
      failed_at: null,
      meta_event_id: sale.meta_event_id || m.meta_event_id || null,
      metadata: { legacy_sale_id: sale.id, legacy: sale },
    })
  }

  for (const renewal of renewals) {
    const client = clientById.get(renewal.client_id)
    const source = client ? sourceByLegacyId.get(client.legacy_id) : null
    const classification = classifyRenewalRow(renewal, client, source, duplicateLookups)
    renewal.migration_classification = classification.classification
    renewal.migration_quarantine_reason = classification.reason
  }
  for (const payment of payments) {
    const client = clientById.get(payment.client_id)
    const source = client ? sourceByLegacyId.get(client.legacy_id) : null
    const classification = classifyPaymentRow(payment, client, source, duplicateLookups)
    payment.migration_classification = classification.classification
    payment.migration_quarantine_reason = classification.reason
  }

  const welcomeState = local.files && local.files.welcome_state && typeof local.files.welcome_state === 'object' ? local.files.welcome_state : {}
  const welcomeSource = welcomeState.contacts && typeof welcomeState.contacts === 'object' ? welcomeState.contacts : welcomeState
  const welcomeEntries = Array.isArray(welcomeSource)
    ? welcomeSource.map((value, index) => [String(index), value])
    : Object.entries(welcomeSource)
  for (const [key, item] of welcomeEntries) {
    const phone = normalizePhone(item.phone || item.number || item.remoteJid || item.jid || key)
    const matched = clients.find((client) => client.phone_e164 === phone)
    if (!matched) {
      welcomeOrphans.push({ phone: maskPhone(phone), status: item.status || null, reason: 'no_client_match' })
      continue
    }
    messages.push({
      id: id('message', `welcome:${matched.id}:${item.updatedAt || item.createdAt || key}`),
      client_id: matched.id,
      template_key: 'welcome',
      integration_key: 'evolution_api',
      channel: 'whatsapp',
      direction: 'outbound',
      to_address: matched.whatsapp_jid,
      from_address: null,
      status: item.welcomeSent ? 'sent' : 'skipped',
      subject: 'Boas-vindas legado',
      body: null,
      media_url: null,
      external_message_id: null,
      sent_at: parseDate(item.welcomeSentAt || item.updatedAt),
      delivered_at: null,
      failed_at: item.status === 'welcome_error' ? parseDate(item.updatedAt) : null,
      error: item.status === 'welcome_error' ? 'welcome_error' : null,
      metadata: { legacy_welcome_key: key, legacy_welcome: item },
    })
  }

  for (const event of metaEvents) {
    logs.push({
      id: id('log', `meta:${event.id || event.event_id || event.created_at}`),
      scope: 'meta_capi',
      level: event.error ? 'error' : 'info',
      event: 'legacy_meta_event',
      client_id: null,
      test_id: null,
      account_id: null,
      integration_key: 'meta_capi',
      message: event.error ? 'Meta event legado com erro' : 'Meta event legado',
      metadata: { legacy_meta_event: event },
    })
  }

  const reminderOrphansByReason = reminderOrphans.reduce((acc, row) => {
    acc[row.reason] = (acc[row.reason] || 0) + 1
    return acc
  }, {})
  const skippedAccounts = clients.length - accounts.length

  const normalized = {
    generated_at: new Date().toISOString(),
    dry_run: true,
    tables: {
      clients,
      tests,
      accounts,
      account_slots: accountSlots,
      renewals,
      payments,
      problems,
      messages,
      pipeline_events: pipelineEvents,
      logs,
    },
    diagnostics: {
      duplicates_by_phone: duplicateReport.phone_groups.length,
      duplicates_by_username: duplicateReport.username_groups.length,
      account_creation_criteria: accountCriteria,
      accounts_skipped_no_credentials: skippedAccounts,
      reminder_orphans: reminderOrphans.length,
      reminder_orphans_by_reason: reminderOrphansByReason,
      reminder_client_kind_orphans: reminderOrphansByReason.no_client_match || 0,
      welcome_orphans: welcomeOrphans.length,
      source_counts: {
        clients: oldClients.length,
        reminders: reminders.length,
        reminders_client_kind: reminders.filter((row) => String(row.kind || metadata(row).kind || '').toLowerCase() === 'client').length,
        sales: sales.length,
        meta_conversion_events: metaEvents.length,
        welcome_state: welcomeEntries.length,
      },
    },
  }

  const manualReviewRequired = buildManualReviewRequired({
    clients,
    accounts,
    duplicateReport,
    reminderOrphans,
    welcomeOrphans,
    normalized,
  })
  const importPlan = buildImportPlan({
    clients,
    tests,
    accounts,
    renewals,
    payments,
    manualReviewRequired,
    reminderOrphans,
    welcomeOrphans,
  })

  write('normalized.json', normalized)
  write('duplicates-report.json', duplicateReport)
  write('reminders-orphans.json', { generated_at: new Date().toISOString(), count: reminderOrphans.length, rows: reminderOrphans })
  write('welcome-orphans.json', { generated_at: new Date().toISOString(), count: welcomeOrphans.length, rows: welcomeOrphans })
  write('manual-review-required.json', manualReviewRequired)
  write('import-plan.json', importPlan)

  console.log(`[normalize] clients=${clients.length} tests=${tests.length} accounts=${accounts.length} renewals=${renewals.length} payments=${payments.length}`)
  console.log(`[normalize] account_criteria=${JSON.stringify(accountCriteria)}`)
  console.log(`[normalize] reminder_orphans=${reminderOrphans.length} welcome_orphans=${welcomeOrphans.length}`)
  console.log(`[normalize] duplicates phone=${duplicateReport.phone_groups.length} username=${duplicateReport.username_groups.length}`)
}

function buildImportPlan({ clients, tests, accounts, renewals, payments, manualReviewRequired, reminderOrphans, welcomeOrphans }) {
  const safeClients = clients.filter((row) => row.migration_classification === 'import_safe')
  const safeTests = tests.filter((row) => row.migration_classification === 'import_safe')
  const safeAccounts = accounts.filter((row) => row.migration_classification === 'import_safe')
  const safeRenewals = renewals.filter((row) => row.migration_classification === 'import_safe')
  const safePayments = payments.filter((row) => row.migration_classification === 'import_safe')

  const quarantineRows = [
    ...clients.filter((row) => String(row.migration_classification || '').startsWith('quarantine')),
    ...tests.filter((row) => String(row.migration_classification || '').startsWith('quarantine')),
    ...accounts.filter((row) => String(row.migration_classification || '').startsWith('quarantine')),
    ...renewals.filter((row) => String(row.migration_classification || '').startsWith('quarantine')),
    ...payments.filter((row) => String(row.migration_classification || '').startsWith('quarantine')),
  ]

  const historyRows = [
    ...clients.filter((row) => row.migration_classification === 'history_only'),
    ...tests.filter((row) => row.migration_classification === 'history_only'),
    ...accounts.filter((row) => row.migration_classification === 'history_only'),
    ...renewals.filter((row) => row.migration_classification === 'history_only'),
    ...payments.filter((row) => row.migration_classification === 'history_only'),
  ]

  const quarantineWelcomeOrphans = (welcomeOrphans || []).map((row) => ({
    ...row,
    migration_classification: 'quarantine_welcome_orphan',
  }))

  return {
    generated_at: new Date().toISOString(),
    mode: 'safe-only',
    safe_clients: safeClients.length,
    safe_tests: safeTests.length,
    safe_accounts: safeAccounts.length,
    safe_renewals: safeRenewals.length,
    safe_payments: safePayments.length,
    quarantine_total: quarantineRows.length + quarantineWelcomeOrphans.length,
    history_only_total: historyRows.length,
    breakdown: {
      safe_clients: safeClients.map((row) => ({ id: row.id, legacy_id: row.legacy_id, classification: row.migration_classification })),
      safe_tests: safeTests.map((row) => ({ id: row.id, client_id: row.client_id, classification: row.migration_classification })),
      safe_accounts: safeAccounts.map((row) => ({ id: row.id, client_id: row.client_id, classification: row.migration_classification })),
      safe_renewals: safeRenewals.map((row) => ({ id: row.id, client_id: row.client_id, classification: row.migration_classification })),
      safe_payments: safePayments.map((row) => ({ id: row.id, client_id: row.client_id, classification: row.migration_classification })),
      quarantine_total: quarantineRows.length + quarantineWelcomeOrphans.length,
      history_only_total: historyRows.length,
      quarantine_welcome_orphans: quarantineWelcomeOrphans.length,
      manual_review_total: (manualReviewRequired.registros_que_nao_devem_importar_automaticamente || []).length,
      manual_review_required: manualReviewRequired.registros_que_nao_devem_importar_automaticamente || [],
    },
  }
}

function buildManualReviewRequired({ clients, accounts, duplicateReport, reminderOrphans, welcomeOrphans, normalized }) {
  const criticalPhoneDuplicates = (duplicateReport.phone_groups || []).filter((group) => group.manual_review_required)
  const criticalUsernameDuplicates = (duplicateReport.username_groups || []).filter((group) => group.count > 1)

  const likelyRealWelcomeOrphans = (welcomeOrphans || []).filter((row) => row.phone && row.phone !== '-' && row.reason === 'no_client_match')

  const clientsWithoutPhone = (clients || []).filter((row) => !row.phone_e164).map((row) => ({
    legacy_id: row.legacy_id,
    name: row.name ? maskText(row.name) : '-',
    phone: '-',
    status: row.status,
    source: row.source || null,
    reason: 'missing_phone',
  }))

  const suspiciousAccounts = (accounts || []).filter((row) => {
    const reasons = []
    if (row.status !== 'active') reasons.push('non_active_status')
    if (!row.username) reasons.push('missing_username')
    if (!row.password_secret) reasons.push('missing_password')
    if (!(row.m3u_url_secret || row.hls_url_secret || row.device_key)) reasons.push('missing_transport')
    if ((row.legacy_metadata && Array.isArray(row.legacy_metadata.credential_reasons) && row.legacy_metadata.credential_reasons.length < 2)) reasons.push('partial_credentials')
    return reasons.length > 0
  }).map((row) => ({
    account_id: row.id,
    client_id: row.client_id,
    username: maskText(row.username),
    status: row.status,
    max_slots: row.max_slots,
    provider: row.provider || null,
    reason: [
      row.status !== 'active' ? 'non_active_status' : null,
      !row.username ? 'missing_username' : null,
      !row.password_secret ? 'missing_password' : null,
      !(row.m3u_url_secret || row.hls_url_secret || row.device_key) ? 'missing_transport' : null,
      row.legacy_metadata && Array.isArray(row.legacy_metadata.credential_reasons) && row.legacy_metadata.credential_reasons.length < 2 ? 'partial_credentials' : null,
    ].filter(Boolean).join(','),
  }))

  const doNotImportAutomatically = []

  for (const group of criticalPhoneDuplicates) {
    doNotImportAutomatically.push({
      type: 'duplicate_phone_group',
      key: group.key_masked,
      count: group.count,
      reason: group.manual_review_required ? 'large_or_risky_duplicate_group' : 'duplicate_group',
    })
  }

  for (const group of criticalUsernameDuplicates) {
    doNotImportAutomatically.push({
      type: 'duplicate_username_group',
      key: group.key_masked,
      count: group.count,
      reason: 'duplicate_username_group',
    })
  }

  for (const row of likelyRealWelcomeOrphans.slice(0, 50)) {
    doNotImportAutomatically.push({
      type: 'welcome_orphan',
      key: row.phone,
      count: 1,
      reason: 'possible_real_client_needs_manual_link',
    })
  }

  for (const row of clientsWithoutPhone.slice(0, 50)) {
    doNotImportAutomatically.push({
      type: 'client_without_phone',
      key: row.legacy_id,
      count: 1,
      reason: 'missing_phone',
    })
  }

  for (const row of suspiciousAccounts.slice(0, 50)) {
    doNotImportAutomatically.push({
      type: 'suspicious_account',
      key: row.account_id,
      count: 1,
      reason: row.reason,
    })
  }

  return {
    generated_at: new Date().toISOString(),
    source_counts: {
      clients: normalized.diagnostics.source_counts.clients,
      accounts: accounts.length,
      duplicate_phone_groups: duplicateReport.phone_groups.length,
      duplicate_username_groups: duplicateReport.username_groups.length,
      reminder_orphans: reminderOrphans.length,
      welcome_orphans: welcomeOrphans.length,
    },
    duplicates_by_phone_critical: criticalPhoneDuplicates.map((group) => ({
      key_masked: group.key_masked,
      count: group.count,
      manual_review_required: group.manual_review_required,
      classification: group.duplicate_classification,
      canonical_legacy_id: group.canonical_legacy_id,
      canonical_reason: group.canonical_reason,
      sample_masked: group.sample_masked,
      large_group_analysis: group.large_group_analysis,
    })),
    duplicates_by_username_critical: criticalUsernameDuplicates.map((group) => ({
      key_masked: group.key_masked,
      count: group.count,
      manual_review_required: group.manual_review_required,
      canonical_legacy_id: group.canonical_legacy_id,
      canonical_reason: group.canonical_reason,
      sample_masked: group.sample_masked,
    })),
    welcome_orphans_que_parecem_clientes_reais: likelyRealWelcomeOrphans.map((row) => ({
      phone: row.phone,
      status: row.status,
      reason: row.reason,
    })),
    clients_sem_telefone: clientsWithoutPhone,
    accounts_suspeitas: suspiciousAccounts,
    registros_que_nao_devem_importar_automaticamente: doNotImportAutomatically,
  }
}

function orphanReminder(reminder, reason) {
  const m = metadata(reminder)
  return {
    id: String(reminder.id || ''),
    kind: reminder.kind || m.kind || null,
    reason,
    identifier: maskText(reminder.identifier || m.username || m.orderId || m.pedido),
    phone: maskPhone(reminder.phone || m.phone || m.normalizedPhone),
    client_name: m.clientName ? maskText(m.clientName) : null,
    due_at: reminder.due_at || null,
    status: reminder.status || null,
  }
}

function buildDuplicateReport(oldClients) {
  const phoneGroups = groupDuplicateRows(oldClients, (row) => normalizePhone(row.phone || metadata(row).normalizedPhone || metadata(row).phone))
  const usernameGroups = groupDuplicateRows(oldClients, (row) => getUsername(row))
  return {
    generated_at: new Date().toISOString(),
    phone_groups: phoneGroups.map(([phone, rows]) => duplicateGroup('phone', phone, rows)),
    username_groups: usernameGroups.map(([username, rows]) => duplicateGroup('username', username, rows)),
  }
}

function duplicateGroup(type, key, rows) {
  const manualReview = duplicateGroupManualReviewNeeded(rows)
  const canonical = manualReview ? null : chooseCanonical(rows)
  const large = rows.length >= 10
  return {
    type,
    key_raw: key,
    key_masked: type === 'phone' ? maskPhone(key) : maskText(key),
    count: rows.length,
    manual_review_required: manualReview,
    duplicate_classification: manualReview && type === 'phone' ? 'possible_phone_admin_fallback' : null,
    canonical_legacy_id: canonical ? String(canonical.id || '') : null,
    canonical_reason: canonical ? canonicalReason(canonical) : 'manual_review_required_large_group',
    proposed_duplicate_of: canonical ? rows
      .filter((row) => String(row.id || '') !== String(canonical.id || ''))
      .map((row) => ({
        legacy_id: String(row.id || ''),
        duplicate_of_legacy_id: String(canonical.id || ''),
        status: mapClientStatus(row),
        source: row.source || null,
        updated_at: row.updated_at || null,
      })) : [],
    sample_masked: rows.slice(0, large ? 10 : 5).map((row) => ({
      legacy_id: String(row.id || ''),
      name: row.name ? maskText(row.name) : '-',
      phone: maskPhone(row.phone || metadata(row).normalizedPhone || metadata(row).phone),
      username: maskText(getUsername(row)),
      status: mapClientStatus(row),
      source: row.source || null,
      has_due: Boolean(dueDate(row)),
      has_credentials: hasTechnicalCredential(row),
      updated_at: row.updated_at || null,
    })),
    large_group_analysis: large ? explainLargeDuplicateGroup(rows) : null,
  }
}

function canonicalReason(row) {
  const parts = []
  const status = mapClientStatus(row)
  if (status === 'active') parts.push('cliente ativo/pago')
  if (dueDate(row)) parts.push('vencimento confiavel')
  if (getUsername(row) && getPassword(row)) parts.push('credenciais completas')
  parts.push('mais recente como desempate')
  return parts.join(' > ')
}

main()
