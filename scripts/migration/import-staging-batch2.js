#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.resolve(ROOT, process.env.MIGRATION_OUTPUT_DIR || '.migration-output')
const LIMIT = Number(process.env.BATCH2_LIMIT || 10)

function arg(name) {
  return process.argv.includes(name)
}

function loadEnvFile() {
  const file = path.join(ROOT, '.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([^#=\s]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function stableUuid(seed) {
  const hex = crypto.createHash('sha1').update(String(seed || '')).digest('hex').slice(0, 32)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}

function maskName(value) {
  const text = String(value || '').trim()
  if (!text) return '-'
  return text.split(/\s+/).map((part) => part.length <= 3 ? '***' : `${part.slice(0, 2)}***${part.slice(-1)}`).join(' ')
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return '-'
  return `${digits.slice(0, 4)}***${digits.slice(-2)}`
}

function appKey(value) {
  const text = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (text.includes('blessed')) return 'blessed'
  if (text.includes('playsim') || text.includes('play sim')) return 'playsim'
  if (text.includes('assist')) return 'assist_plus'
  if (text.includes('fun')) return 'funplay'
  if (text.includes('magic')) return 'magic'
  if (text.includes('lotus')) return 'lotus'
  if (text.includes('hd')) return 'hdplayer'
  if (text.includes('xcloud')) return 'xcloud'
  return null
}

function panelKey(value) {
  const text = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (text.includes('yellow') || text.includes('brasil')) return 'brasil_yellow'
  if (text.includes('ninety') || text.includes('xbr')) return 'ninety'
  if (text.includes('uniplay')) return 'uniplay'
  if (text.includes('devxtop') || text.includes('magic')) return 'devxtop_magic'
  if (text.includes('titanium')) return 'titanium'
  if (text.includes('area')) return 'areaplay'
  if (text.includes('cinemax')) return 'cinemax'
  return null
}

function sanitizeRow(table, row) {
  const keep = {
    clients: ['id', 'legacy_id', 'name', 'phone_e164', 'phone_raw', 'telegram_chat_id', 'telegram_user_id', 'whatsapp_jid', 'status', 'source', 'duplicate_of', 'archived_reason', 'notes', 'legacy_metadata', 'created_at', 'updated_at'],
    accounts: ['id', 'client_id', 'source_test_id', 'app_id', 'panel_id', 'username', 'password_secret', 'm3u_url_secret', 'hls_url_secret', 'device_key', 'provider', 'provider_code', 'panel_external_id', 'max_slots', 'status', 'activated_at', 'expires_at', 'legacy_metadata', 'created_at', 'updated_at'],
    account_slots: ['id', 'account_id', 'client_id', 'slot_number', 'status', 'device_key', 'assigned_at', 'released_at', 'expires_at', 'metadata', 'created_at', 'updated_at'],
    renewals: ['id', 'client_id', 'account_id', 'slot_id', 'plan_key', 'amount_cents', 'currency', 'status', 'due_at', 'paid_until', 'confirmed_at', 'operator_ref', 'metadata', 'created_at', 'updated_at'],
  }[table]
  const out = {}
  for (const key of keep) if (row[key] !== undefined) out[key] = row[key]
  return out
}

async function loadStaging(db) {
  const [clients, accounts, slots, renewals, apps, panels] = await Promise.all([
    db.from('clients').select('id,legacy_id,phone_e164'),
    db.from('accounts').select('id,client_id,username'),
    db.from('account_slots').select('id,account_id'),
    db.from('renewals').select('id,client_id'),
    db.from('apps').select('id,key,name'),
    db.from('panels').select('id,key,name'),
  ])
  for (const [name, result] of Object.entries({ clients, accounts, slots, renewals, apps, panels })) {
    if (result.error) throw new Error(`${name}: ${result.error.message}`)
  }
  return {
    clients: clients.data || [],
    accounts: accounts.data || [],
    slots: slots.data || [],
    renewals: renewals.data || [],
    appsByKey: new Map((apps.data || []).map((row) => [row.key, row.id])),
    panelsByKey: new Map((panels.data || []).map((row) => [row.key, row.id])),
  }
}

function candidateRows(normalized, duplicates, staging) {
  const tables = normalized.tables || {}
  const clients = tables.clients || []
  const accounts = tables.accounts || []
  const slots = tables.account_slots || []
  const renewals = tables.renewals || []
  const accountByClientId = new Map(accounts.map((row) => [row.client_id, row]))
  const slotsByAccountId = new Map()
  const renewalsByClientId = new Map()
  for (const slot of slots) {
    const list = slotsByAccountId.get(slot.account_id) || []
    list.push(slot)
    slotsByAccountId.set(slot.account_id, list)
  }
  for (const renewal of renewals) {
    if (!renewal.due_at || renewal.status === 'cancelled') continue
    const list = renewalsByClientId.get(renewal.client_id) || []
    list.push(renewal)
    renewalsByClientId.set(renewal.client_id, list)
  }

  const existingClientIds = new Set(staging.clients.map((row) => row.id))
  const existingLegacyIds = new Set(staging.clients.map((row) => row.legacy_id).filter(Boolean))
  const existingPhones = new Set(staging.clients.map((row) => row.phone_e164).filter(Boolean))
  const existingUsers = new Set(staging.accounts.map((row) => row.username).filter(Boolean))
  const phoneGroups = new Map((duplicates.phone_groups || []).map((group) => [group.key_raw, group]))
  const userGroups = new Map((duplicates.username_groups || []).map((group) => [group.key_raw, group]))
  const selectedPhones = new Set()
  const selectedUsers = new Set()

  return clients
    .map((client) => {
      const account = accountByClientId.get(client.id)
      const clientUuid = stableUuid(client.legacy_id || client.id)
      const accountUuid = account ? stableUuid(account.id) : null
      const renewalsForClient = renewalsByClientId.get(client.id) || []
      const app = appKey(account?.app_key)
      const panel = panelKey(account?.panel_key || account?.provider)
      const phoneGroup = client.phone_e164 ? phoneGroups.get(client.phone_e164) : null
      const userGroup = account?.username ? userGroups.get(account.username) : null
      const duplicateGroups = [phoneGroup, userGroup].filter(Boolean)
      const canonical = duplicateGroups.every((group) => !group.manual_review_required && String(group.canonical_legacy_id) === String(client.legacy_id))
      const criticalQuarantine =
        String(client.migration_classification || '').includes('admin_fallback') ||
        String(account?.migration_classification || '').includes('admin_fallback') ||
        duplicateGroups.some((group) => group.manual_review_required)
      const completeCredentials = Boolean(account?.username && account?.password_secret && (account?.m3u_url_secret || account?.hls_url_secret || account?.device_key))
      const reliableDue = Boolean(account?.expires_at || renewalsForClient.length)
      const identifiable = Boolean(app && panel && staging.appsByKey.has(app) && staging.panelsByKey.has(panel))
      const alreadyImported = existingClientIds.has(clientUuid) || existingLegacyIds.has(client.legacy_id) || existingPhones.has(client.phone_e164) || existingUsers.has(account?.username)
      const ok =
        client.status === 'active' &&
        Boolean(client.phone_e164) &&
        completeCredentials &&
        reliableDue &&
        identifiable &&
        canonical &&
        !criticalQuarantine &&
        !alreadyImported

      return {
        client,
        account,
        slots: slotsByAccountId.get(account?.id) || [],
        renewals: renewalsForClient,
        clientUuid,
        accountUuid,
        app,
        panel,
        ok,
        due: account?.expires_at || renewalsForClient[0]?.due_at || null,
        duplicate_summary: duplicateGroups.map((group) => ({ count: group.count, manual_review_required: Boolean(group.manual_review_required) })),
      }
    })
    .filter((entry) => entry.ok)
    .sort((a, b) => String(a.due || '').localeCompare(String(b.due || '')))
    .filter((entry) => {
      const phone = entry.client.phone_e164
      const user = entry.account.username
      if (selectedPhones.has(phone) || selectedUsers.has(user)) return false
      selectedPhones.add(phone)
      selectedUsers.add(user)
      return true
    })
    .slice(0, LIMIT)
}

function buildRows(selected, staging) {
  const clientIdMap = new Map(selected.map((entry) => [entry.client.id, entry.clientUuid]))
  const accountIdMap = new Map(selected.map((entry) => [entry.account.id, entry.accountUuid]))
  const slotIdMap = new Map(selected.flatMap((entry) => entry.slots.map((slot) => [slot.id, stableUuid(slot.id)])))
  const renewalIdMap = new Map(selected.flatMap((entry) => entry.renewals.map((renewal) => [renewal.id, stableUuid(renewal.id)])))
  const accountByClient = new Map(selected.map((entry) => [entry.client.id, entry.accountUuid]))

  return {
    clients: selected.map((entry) => sanitizeRow('clients', {
      ...entry.client,
      id: entry.clientUuid,
      duplicate_of: null,
      legacy_metadata: {
        ...(entry.client.legacy_metadata || {}),
        migration_batch: 'batch2_safe_only',
        migration_original_classification: entry.client.migration_classification || null,
      },
    })),
    accounts: selected.map((entry) => sanitizeRow('accounts', {
      ...entry.account,
      id: entry.accountUuid,
      client_id: clientIdMap.get(entry.account.client_id),
      source_test_id: null,
      app_id: staging.appsByKey.get(entry.app),
      panel_id: staging.panelsByKey.get(entry.panel),
      app_key: undefined,
      panel_key: undefined,
      legacy_metadata: {
        ...(entry.account.legacy_metadata || {}),
        migration_batch: 'batch2_safe_only',
        migration_original_classification: entry.account.migration_classification || null,
      },
    })),
    account_slots: selected.flatMap((entry) => entry.slots.map((slot) => sanitizeRow('account_slots', {
      ...slot,
      id: slotIdMap.get(slot.id),
      account_id: accountIdMap.get(slot.account_id),
      client_id: slot.client_id ? clientIdMap.get(slot.client_id) : null,
    }))),
    renewals: selected.flatMap((entry) => entry.renewals.map((renewal) => sanitizeRow('renewals', {
      ...renewal,
      id: renewalIdMap.get(renewal.id),
      client_id: clientIdMap.get(renewal.client_id),
      account_id: renewal.account_id ? accountIdMap.get(renewal.account_id) : accountByClient.get(renewal.client_id),
      slot_id: null,
      metadata: {
        ...(renewal.metadata || {}),
        migration_batch: 'batch2_safe_only',
        migration_original_classification: renewal.migration_classification || null,
      },
    }))),
  }
}

async function upsertRows(db, table, rows) {
  if (!rows.length) return
  const { error } = await db.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: false })
  if (error) throw new Error(`${table}: ${error.message}`)
}

async function main() {
  loadEnvFile()
  const dryRun = arg('--dry-run') || !arg('--execute')
  const confirmed = arg('--execute-confirm-batch2-safe-only')
  if (!dryRun && !confirmed) throw new Error('Execucao bloqueada. Use --execute --execute-confirm-batch2-safe-only.')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Env NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes.')

  const normalized = readJson(path.join(OUT_DIR, 'normalized.json'))
  const duplicates = readJson(path.join(OUT_DIR, 'duplicates-report.json'))
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const staging = await loadStaging(db)
  const selected = candidateRows(normalized, duplicates, staging)
  const rows = buildRows(selected, staging)

  const summary = {
    mode: dryRun ? 'dry-run' : 'execute',
    batch: 'batch2_safe_only',
    limit: LIMIT,
    selected_clients: selected.length,
    staging_before: {
      clients: staging.clients.length,
      accounts: staging.accounts.length,
      account_slots: staging.slots.length,
      renewals: staging.renewals.length,
    },
    to_import: {
      clients: rows.clients.length,
      accounts: rows.accounts.length,
      account_slots: rows.account_slots.length,
      renewals: rows.renewals.length,
    },
    duplicate_guard: {
      excludes_existing_clients: true,
      existing_clients_found_in_batch: selected.filter((entry) => staging.clients.some((row) => row.id === entry.clientUuid || row.legacy_id === entry.client.legacy_id)).length,
      existing_phone_conflicts: selected.filter((entry) => staging.clients.some((row) => row.phone_e164 === entry.client.phone_e164)).length,
      existing_username_conflicts: selected.filter((entry) => staging.accounts.some((row) => row.username === entry.account.username)).length,
    },
    selected_masked: selected.map((entry) => ({
      name: maskName(entry.client.name),
      phone: maskPhone(entry.client.phone_e164),
      app: entry.app,
      panel: entry.panel,
      due: entry.due,
      source_classification: entry.client.migration_classification,
      duplicate_groups: entry.duplicate_summary,
    })),
  }

  console.log(JSON.stringify(summary, null, 2))
  if (dryRun) return

  await upsertRows(db, 'clients', rows.clients)
  await upsertRows(db, 'accounts', rows.accounts)
  await upsertRows(db, 'account_slots', rows.account_slots)
  await upsertRows(db, 'renewals', rows.renewals)
  console.log(JSON.stringify({ executed: true, inserted_or_updated: summary.to_import }, null, 2))
}

main().catch((err) => {
  console.error(`[import-staging-batch2] erro: ${err.message || String(err)}`)
  process.exitCode = 1
})
