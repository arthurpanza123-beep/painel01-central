import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const envPath = path.join(ROOT, '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index)
    const value = trimmed.slice(index + 1)
    if (!process.env[key]) process.env[key] = value
  }
}

const args = new Set(process.argv.slice(2))
const APPLY_SAFE = args.has('--apply-safe')
const TS = new Date().toISOString().replace(/[:.]/g, '-')
const OUT_DIR = path.join(ROOT, 'storage', 'audits', `client-audit-${TS}`)

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function metadata(row) {
  return row?.legacy_metadata && typeof row.legacy_metadata === 'object' && !Array.isArray(row.legacy_metadata)
    ? row.legacy_metadata
    : {}
}

function valueFromMetadata(row, keys) {
  const source = metadata(row)
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function isNoiseClient(client) {
  const text = normalizeText(`${client.name || ''} ${client.source || ''}`)
  return /\b(codex|mock|teste|test|temporario|temporary|lead fake|v0)\b/.test(text)
}

function isActiveStatus(status) {
  return ['active', 'test_active', 'ativo'].includes(String(status || '').toLowerCase())
}

function isOperationalAccount(account) {
  const metadata = account?.legacy_metadata && typeof account.legacy_metadata === 'object' && !Array.isArray(account.legacy_metadata)
    ? account.legacy_metadata
    : {}
  if (metadata.merged_into_account_id || metadata.merged_reason === 'shared_two_screen_account_mirror') return false
  return ['active', 'provisioning'].includes(String(account?.status || 'active').toLowerCase())
}

function isOccupiedSlot(slot) {
  return String(slot?.status || '').toLowerCase() === 'occupied' || Boolean(slot?.client_id)
}

function latestBy(rows, key, dateKeys) {
  const map = new Map()
  for (const row of rows) {
    const id = row[key]
    if (!id) continue
    const current = map.get(id)
    const rowDate = dateKeys.map((dateKey) => row[dateKey]).find(Boolean) || ''
    const currentDate = current ? dateKeys.map((dateKey) => current[dateKey]).find(Boolean) || '' : ''
    if (!current || String(rowDate) > String(currentDate)) map.set(id, row)
  }
  return map
}

function addGroup(groups, key, client) {
  if (!key) return
  const list = groups.get(key) || []
  list.push(client)
  groups.set(key, list)
}

function csvValue(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function writeCsv(file, rows, columns) {
  const lines = [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(',')),
  ]
  fs.writeFileSync(file, lines.join('\n'))
}

async function fetchAll(db, table, select = '*') {
  const rows = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await db.from(table).select(select).range(from, from + pageSize - 1)
    if (error) {
      return { rows: [], error: error.message }
    }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return { rows, error: null }
}

function scoreClient(client, context) {
  const accounts = context.accountsByClient.get(client.id) || []
  const slots = context.slotsByClient.get(client.id) || []
  const renewal = context.latestRenewalByClient.get(client.id)
  const test = context.latestTestByClient.get(client.id)
  const due = renewal?.due_at || renewal?.paid_until || accounts[0]?.expires_at || test?.expires_at || ''
  const dueMs = due ? new Date(due).getTime() : 0
  let score = 0
  if (String(client.status).toLowerCase() === 'active') score += 60
  if (String(client.status).toLowerCase() === 'test_active') score += 20
  if (accounts.some((account) => String(account.status || '').toLowerCase() === 'active')) score += 25
  if (slots.some((slot) => String(slot.status || '').toLowerCase() === 'occupied')) score += 25
  if (Number.isFinite(dueMs) && dueMs > Date.now()) score += 20
  if (renewal?.status === 'applied') score += 10
  if (!isNoiseClient(client)) score += 10
  return score
}

function summarizeClient(client, context) {
  const accounts = context.accountsByClient.get(client.id) || []
  const slots = context.slotsByClient.get(client.id) || []
  const renewal = context.latestRenewalByClient.get(client.id)
  const account = accounts[0] || null
  const app = account?.app_id ? context.appsById.get(account.app_id) : null
  const panel = account?.panel_id ? context.panelsById.get(account.panel_id) : null
  return {
    id: client.id,
    name: client.name || '',
    phone_e164: client.phone_e164 || '',
    status: client.status || '',
    source: client.source || '',
    username: account?.username || valueFromMetadata(client, ['username', 'usuario', 'xtream_username']),
    app: app?.name || account?.provider || valueFromMetadata(client, ['app', 'app_name', 'app_key']),
    panel: panel?.name || account?.provider || valueFromMetadata(client, ['panel', 'painel', 'panel_key']),
    plan_key: renewal?.plan_key || valueFromMetadata(client, ['plan_key', 'plano']),
    amount_cents: renewal?.amount_cents ?? '',
    due_at: renewal?.due_at || renewal?.paid_until || account?.expires_at || '',
    screens_count: renewal?.metadata?.screens_count || metadata(client).screens_count || account?.legacy_metadata?.screens_count || '',
    account_ids: accounts.map((accountRow) => accountRow.id).join('|'),
    occupied_slot_ids: slots.filter((slot) => String(slot.status || '').toLowerCase() === 'occupied').map((slot) => slot.id).join('|'),
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env ausente.')
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const tables = {}
  for (const table of ['clients', 'tests', 'renewals', 'accounts', 'account_slots', 'pipeline_events', 'logs', 'apps', 'panels']) {
    const result = await fetchAll(db, table)
    tables[table] = result.rows
    if (result.error) console.warn(`[AUDIT_TABLE_READ_FAILED] ${table}: ${result.error}`)
  }

  fs.writeFileSync(path.join(OUT_DIR, 'snapshot-before.json'), JSON.stringify(tables, null, 2))

  const clients = tables.clients || []
  const accounts = tables.accounts || []
  const slots = tables.account_slots || []
  const renewals = tables.renewals || []
  const tests = tables.tests || []
  const context = {
    appsById: new Map((tables.apps || []).map((row) => [row.id, row])),
    panelsById: new Map((tables.panels || []).map((row) => [row.id, row])),
    accountsByClient: new Map(),
    slotsByClient: new Map(),
    latestRenewalByClient: latestBy(renewals, 'client_id', ['confirmed_at', 'created_at', 'due_at']),
    latestTestByClient: latestBy(tests, 'client_id', ['created_at', 'activated_at', 'expires_at']),
  }
  context.accountById = new Map(accounts.map((row) => [row.id, row]))

  for (const account of accounts) {
    if (!account.client_id) continue
    const list = context.accountsByClient.get(account.client_id) || []
    list.push(account)
    context.accountsByClient.set(account.client_id, list)
  }
  for (const slot of slots) {
    if (!slot.client_id) continue
    const list = context.slotsByClient.get(slot.client_id) || []
    list.push(slot)
    context.slotsByClient.set(slot.client_id, list)
  }

  const summaries = clients.map((client) => summarizeClient(client, context))
  writeCsv(path.join(OUT_DIR, 'clients-before.csv'), summaries, [
    'id', 'name', 'phone_e164', 'status', 'source', 'username', 'app', 'panel', 'plan_key', 'amount_cents', 'due_at', 'screens_count', 'account_ids', 'occupied_slot_ids',
  ])

  const byPhone = new Map()
  const byUsername = new Map()
  const byName = new Map()
  for (const client of clients) {
    const summary = summarizeClient(client, context)
    addGroup(byPhone, normalizePhone(client.phone_e164 || client.phone_raw || ''), client)
    addGroup(byUsername, normalizeText(summary.username), client)
    addGroup(byName, normalizeText(client.name || ''), client)
  }

  const duplicateGroups = []
  for (const [type, groups] of [['phone', byPhone], ['username', byUsername], ['name', byName]]) {
    for (const [key, group] of groups.entries()) {
      if (!key || group.length < 2) continue
      if (type === 'username' && isSharedTwoScreenUsernameGroup(key, group, context)) continue
      const ranked = group
        .map((client) => ({ client, score: scoreClient(client, context), summary: summarizeClient(client, context) }))
        .sort((a, b) => b.score - a.score || String(b.summary.due_at).localeCompare(String(a.summary.due_at)))
      duplicateGroups.push({
        type,
        key,
        canonical_id: ranked[0].client.id,
        members: ranked.map((item) => ({ ...item.summary, score: item.score, canonical: item.client.id === ranked[0].client.id })),
      })
    }
  }

  const actions = []
  const seenArchive = new Set()
  for (const group of duplicateGroups) {
    for (const member of group.members) {
      if (member.canonical || seenArchive.has(member.id)) continue
      const client = clients.find((row) => row.id === member.id)
      if (String(client?.status || '').toLowerCase() === 'archived') continue
      const active = isActiveStatus(client?.status)
      const noOccupiedSlot = !member.occupied_slot_ids
      const safe = (isNoiseClient(client) || !active) && noOccupiedSlot
      actions.push({
        action: safe ? 'archive_duplicate_safe' : 'review_duplicate',
        safe,
        client_id: member.id,
        canonical_id: group.canonical_id,
        reason: `duplicate_${group.type}`,
        before_status: client?.status || null,
        name: member.name,
        phone_e164: member.phone_e164,
        username: member.username,
      })
      if (safe) seenArchive.add(member.id)
    }
  }
  for (const client of clients) {
    if (seenArchive.has(client.id)) continue
    if (String(client.status || '').toLowerCase() === 'archived') continue
    const summary = summarizeClient(client, context)
    if (isNoiseClient(client) && !isActiveStatus(client.status) && !summary.occupied_slot_ids) {
      actions.push({
        action: 'archive_noise_safe',
        safe: true,
        client_id: client.id,
        canonical_id: null,
        reason: 'noise_client',
        before_status: client.status || null,
        name: summary.name,
        phone_e164: summary.phone_e164,
        username: summary.username,
      })
      seenArchive.add(client.id)
    }
  }

  const denilson = summaries.filter((row) => normalizeText(row.name).includes('denilson'))
  const brena = summaries.filter((row) => normalizeText(row.name).includes('brena'))
  const report = {
    generated_at: new Date().toISOString(),
    mode: APPLY_SAFE ? 'apply-safe' : 'dry-run',
    output_dir: OUT_DIR,
    totals_before: {
      clients: clients.length,
      active: clients.filter((client) => String(client.status).toLowerCase() === 'active').length,
      test_active: clients.filter((client) => String(client.status).toLowerCase() === 'test_active').length,
      expired: clients.filter((client) => String(client.status).toLowerCase() === 'expired').length,
      archived: clients.filter((client) => String(client.status).toLowerCase() === 'archived').length,
    },
    duplicate_groups: duplicateGroups.length,
    actions,
    clients_with_doubt: actions.filter((action) => !action.safe),
    denilson,
    brena,
  }
  fs.writeFileSync(path.join(OUT_DIR, 'audit-report.json'), JSON.stringify(report, null, 2))

  if (APPLY_SAFE) {
    const applied = []
    for (const action of actions.filter((item) => item.safe)) {
      const client = clients.find((row) => row.id === action.client_id)
      const nextMetadata = {
        ...metadata(client),
        archived_by_client_audit_at: new Date().toISOString(),
        archived_by_client_audit_reason: action.reason,
        canonical_client_id: action.canonical_id,
        previous_status: action.before_status,
      }
      const { error } = await db
        .from('clients')
        .update({
          status: 'archived',
          duplicate_of: action.canonical_id,
          archived_reason: action.reason,
          legacy_metadata: nextMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', action.client_id)
        .neq('status', 'active')
      applied.push({ ...action, applied: !error, error: error?.message || null })
    }
    fs.writeFileSync(path.join(OUT_DIR, 'applied-safe-actions.json'), JSON.stringify(applied, null, 2))
  }

  const printable = {
    output_dir: OUT_DIR,
    mode: report.mode,
    totals_before: report.totals_before,
    duplicate_groups: report.duplicate_groups,
    safe_actions: actions.filter((action) => action.safe).length,
    review_actions: actions.filter((action) => !action.safe).length,
    denilson_count: denilson.length,
    brena_count: brena.length,
  }
  console.log(JSON.stringify(printable, null, 2))
}

function isSharedTwoScreenUsernameGroup(_key, group, context) {
  if (group.length !== 2) return false
  const clientIds = new Set(group.map((client) => client.id))
  const occupiedSlots = []
  for (const client of group) {
    const slots = (context.slotsByClient.get(client.id) || []).filter(isOccupiedSlot)
    if (slots.length !== 1) return false
    occupiedSlots.push(slots[0])
  }
  const accountIds = new Set(occupiedSlots.map((slot) => slot.account_id))
  if (accountIds.size !== 1) return false
  const account = context.accountById.get([...accountIds][0])
  if (!account || !isOperationalAccount(account) || Number(account.max_slots || 1) < 2) return false
  const accountSlots = (context.slotsByClient ? [...context.slotsByClient.values()].flat() : [])
    .filter((slot) => slot.account_id === account.id && isOccupiedSlot(slot))
  const accountClientIds = new Set(accountSlots.map((slot) => slot.client_id).filter(Boolean))
  return clientIds.size === accountClientIds.size && [...clientIds].every((id) => accountClientIds.has(id))
}

main().catch((error) => {
  console.error(`[CLIENT_AUDIT_FAILED] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
