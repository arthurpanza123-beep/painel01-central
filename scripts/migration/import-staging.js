#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.resolve(ROOT, process.env.MIGRATION_OUTPUT_DIR || '.migration-output')

function arg(name) {
  return process.argv.includes(name)
}

function valueArg(name, fallback) {
  const prefix = `${name}=`
  const found = process.argv.find((entry) => entry.startsWith(prefix))
  if (!found) return fallback
  return found.slice(prefix.length)
}

function mask(value) {
  const text = String(value || '')
  return text.length <= 8 ? '***' : `${text.slice(0, 4)}***${text.slice(-4)}`
}

async function main() {
  const dryRun = arg('--dry-run') || !arg('--execute')
  const mode = valueArg('--mode', 'full')
  const confirmSafeOnly = arg('--execute-confirm-safe-only')
  const normalizedFile = path.join(OUT_DIR, 'normalized.json')
  if (!fs.existsSync(normalizedFile)) throw new Error('Arquivo .migration-output/normalized.json nao encontrado.')
  const normalized = JSON.parse(fs.readFileSync(normalizedFile, 'utf8'))
  const importPlanFile = path.join(OUT_DIR, 'import-plan.json')
  const importPlan = fs.existsSync(importPlanFile) ? JSON.parse(fs.readFileSync(importPlanFile, 'utf8')) : null
  const tables = normalized.tables || {}
  const summary = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 0]))

  if (dryRun) {
    console.log(`[import-staging] dry-run mode=${mode}: nenhuma linha sera inserida.`)
    console.log(JSON.stringify(importPlan || summary, null, 2))
    return
  }

  if (mode === 'safe-only' && !confirmSafeOnly) {
    throw new Error('Modo safe-only exige --execute-confirm-safe-only. Execucao bloqueada por seguranca.')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Env NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes.')
  console.log(`[import-staging] execute url=${mask(url)} key=${mask(key)}`)
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  if (mode !== 'safe-only') {
    throw new Error(`Modo ${mode} ainda bloqueado. Use --mode=safe-only.`)
  }

  const imported = await importSafeOnly(db)
  console.log(JSON.stringify(imported, null, 2))
}

async function importSafeOnly(db) {
  const normalizedPath = path.join(OUT_DIR, 'normalized.json')
  if (!fs.existsSync(normalizedPath)) throw new Error('Arquivo .migration-output/normalized.json nao encontrado.')
  const normalized = JSON.parse(fs.readFileSync(normalizedPath, 'utf8'))
  const tables = normalized.tables || {}

  const safeClients = (tables.clients || []).filter((row) => row.migration_classification === 'import_safe')
  const safeAccounts = (tables.accounts || []).filter((row) => row.migration_classification === 'import_safe')
  const safeRenewals = (tables.renewals || []).filter((row) => row.migration_classification === 'import_safe')
  const safeAccountIds = new Set(safeAccounts.map((row) => row.id))
  const safeSlots = (tables.account_slots || []).filter((row) => safeAccountIds.has(row.account_id))
  const seedIds = await loadSeedIds(db)

  const clientIdMap = new Map(safeClients.map((row) => [row.id, stableUuid(row.legacy_id || row.id)]))
  const accountIdMap = new Map(safeAccounts.map((row) => [row.id, stableUuid(row.id)]))
  const slotIdMap = new Map(safeSlots.map((row) => [row.id, stableUuid(row.id)]))
  const renewalIdMap = new Map(safeRenewals.map((row) => [row.id, stableUuid(row.id)]))
  const accountIdByClientId = new Map(safeAccounts.map((row) => [row.client_id, accountIdMap.get(row.id)]))

  if (safeClients.length === 0 && safeAccounts.length === 0 && safeRenewals.length === 0) {
    throw new Error('Nenhum registro safe-only encontrado para importar.')
  }

  const inserted = {
    clients: 0,
    accounts: 0,
    account_slots: 0,
    renewals: 0,
    tests: 0,
    payments: 0,
  }

  await upsertRows(db, 'clients', safeClients.map((row) => sanitizeRow('clients', remapClientRow(row, clientIdMap))))
  inserted.clients = safeClients.length

  await upsertRows(db, 'accounts', safeAccounts.map((row) => sanitizeRow('accounts', remapAccountRow(row, clientIdMap, accountIdMap, seedIds))))
  inserted.accounts = safeAccounts.length

  await upsertRows(db, 'account_slots', safeSlots.map((row) => sanitizeRow('account_slots', remapSlotRow(row, clientIdMap, accountIdMap, slotIdMap))))
  inserted.account_slots = safeSlots.length

  await upsertRows(db, 'renewals', safeRenewals.map((row) => sanitizeRow('renewals', remapRenewalRow(row, clientIdMap, accountIdMap, renewalIdMap, accountIdByClientId))))
  inserted.renewals = safeRenewals.length

  return {
    mode: 'safe-only',
    inserted,
    skipped: {
      tests: (tables.tests || []).length,
      payments: (tables.payments || []).length,
      quarantine: (tables.clients || []).filter((row) => String(row.migration_classification || '').startsWith('quarantine')).length
        + (tables.accounts || []).filter((row) => String(row.migration_classification || '').startsWith('quarantine')).length
        + (tables.renewals || []).filter((row) => String(row.migration_classification || '').startsWith('quarantine')).length,
      history_only: (tables.clients || []).filter((row) => row.migration_classification === 'history_only').length
        + (tables.accounts || []).filter((row) => row.migration_classification === 'history_only').length
        + (tables.renewals || []).filter((row) => row.migration_classification === 'history_only').length,
    },
  }
}

async function upsertRows(db, table, rows) {
  if (!rows.length) return
  const { error } = await db.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: false })
  if (error) throw new Error(`${table}: ${error.message}`)
}

async function loadSeedIds(db) {
  const [appsResult, panelsResult] = await Promise.all([
    db.from('apps').select('id,key'),
    db.from('panels').select('id,key'),
  ])
  if (appsResult.error) throw new Error(`apps: ${appsResult.error.message}`)
  if (panelsResult.error) throw new Error(`panels: ${panelsResult.error.message}`)
  return {
    apps: new Map((appsResult.data || []).map((row) => [row.key, row.id])),
    panels: new Map((panelsResult.data || []).map((row) => [row.key, row.id])),
  }
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

function remapClientRow(row, clientIdMap) {
  return {
    ...row,
    id: clientIdMap.get(row.id) || stableUuid(row.id),
  }
}

function remapAccountRow(row, clientIdMap, accountIdMap, seedIds) {
  const panelKey = resolvePanelKey(row)
  return {
    ...row,
    id: accountIdMap.get(row.id) || stableUuid(row.id),
    client_id: clientIdMap.get(row.client_id) || stableUuid(row.client_id),
    source_test_id: null,
    app_id: seedIds.apps.get('xcloud') || seedIds.apps.values().next().value,
    panel_id: panelKey ? (seedIds.panels.get(panelKey) || null) : null,
    app_key: undefined,
    panel_key: undefined,
  }
}

function remapSlotRow(row, clientIdMap, accountIdMap, slotIdMap) {
  return {
    ...row,
    id: slotIdMap.get(row.id) || stableUuid(row.id),
    account_id: accountIdMap.get(row.account_id) || stableUuid(row.account_id),
    client_id: row.client_id ? (clientIdMap.get(row.client_id) || stableUuid(row.client_id)) : null,
  }
}

function remapRenewalRow(row, clientIdMap, accountIdMap, renewalIdMap, accountIdByClientId) {
  const accountId = row.account_id ? (accountIdMap.get(row.account_id) || stableUuid(row.account_id)) : (accountIdByClientId.get(row.client_id) || null)
  return {
    ...row,
    id: renewalIdMap.get(row.id) || stableUuid(row.id),
    client_id: clientIdMap.get(row.client_id) || stableUuid(row.client_id),
    account_id: accountId,
    slot_id: null,
  }
}

function resolvePanelKey(row) {
  const value = String(row.panel_key || row.provider || '').toLowerCase()
  if (value.includes('yellow')) return 'brasil_yellow'
  if (value.includes('xbr') || value.includes('ninety')) return 'ninety'
  return null
}

function sanitizeRow(table, row) {
  const keep = {
    clients: ['id', 'legacy_id', 'name', 'phone_e164', 'phone_raw', 'telegram_chat_id', 'telegram_user_id', 'whatsapp_jid', 'status', 'source', 'duplicate_of', 'archived_reason', 'notes', 'legacy_metadata', 'created_at', 'updated_at'],
    accounts: ['id', 'client_id', 'source_test_id', 'app_id', 'panel_id', 'username', 'password_secret', 'm3u_url_secret', 'hls_url_secret', 'device_key', 'provider', 'provider_code', 'panel_external_id', 'max_slots', 'status', 'activated_at', 'expires_at', 'legacy_metadata', 'created_at', 'updated_at'],
    account_slots: ['id', 'account_id', 'client_id', 'slot_number', 'status', 'device_key', 'assigned_at', 'released_at', 'expires_at', 'metadata', 'created_at', 'updated_at'],
    renewals: ['id', 'client_id', 'account_id', 'slot_id', 'plan_key', 'amount_cents', 'currency', 'status', 'due_at', 'paid_until', 'confirmed_at', 'operator_ref', 'metadata', 'created_at', 'updated_at'],
  }[table]
  if (!keep) return row
  const out = {}
  for (const key of keep) {
    if (row[key] !== undefined) out[key] = row[key]
  }
  return out
}

main().catch((err) => {
  console.error(`[import-staging] erro: ${err.message || String(err)}`)
  process.exitCode = 1
})
