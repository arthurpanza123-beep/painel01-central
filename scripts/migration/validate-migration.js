#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.resolve(ROOT, process.env.MIGRATION_OUTPUT_DIR || '.migration-output')

function read(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return '-'
  if (digits.length <= 6) return '***'
  return `${digits.slice(0, 4)}***${digits.slice(-2)}`
}

function maskText(value) {
  const text = String(value || '')
  if (!text) return '-'
  return text.length <= 4 ? '***' : `${text.slice(0, 2)}***${text.slice(-2)}`
}

function groupBy(rows, getKey) {
  const map = new Map()
  for (const row of rows) {
    const key = getKey(row)
    if (!key) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return [...map.entries()].filter(([, items]) => items.length > 1)
}

function main() {
  const normalized = read(path.join(OUT_DIR, 'normalized.json'))
  const diagnostics = normalized.diagnostics || {}
  const tables = normalized.tables || {}
  const clients = tables.clients || []
  const accounts = tables.accounts || []
  const tests = tables.tests || []
  const renewals = tables.renewals || []

  const duplicatePhones = groupBy(clients, (row) => row.phone_e164)
  const duplicateUsers = groupBy(accounts, (row) => row.username)
  const divergentDueDates = []
  const accountByClient = new Map(accounts.map((row) => [row.client_id, row]))
  for (const test of tests) {
    const account = accountByClient.get(test.client_id)
    if (!account || !test.expires_at || !account.expires_at) continue
    if (String(test.expires_at).slice(0, 10) !== String(account.expires_at).slice(0, 10)) {
      divergentDueDates.push({ client_id: test.client_id, test: test.expires_at, account: account.expires_at })
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 0])),
    risks: {
      duplicate_phone_groups: duplicatePhones.length,
      duplicate_username_groups: duplicateUsers.length,
      divergent_due_dates: divergentDueDates.length,
      renewals_without_due_at: renewals.filter((row) => !row.due_at).length,
      clients_without_phone: clients.filter((row) => !row.phone_e164).length,
      reminder_orphans: diagnostics.reminder_orphans || 0,
      welcome_orphans: diagnostics.welcome_orphans || 0,
    },
    examples_masked: {
      duplicate_phones: duplicatePhones.slice(0, 5).map(([phone, rows]) => ({ phone: maskPhone(phone), count: rows.length })),
      duplicate_usernames: duplicateUsers.slice(0, 5).map(([username, rows]) => ({ username: maskText(username), count: rows.length })),
      divergent_due_dates: divergentDueDates.slice(0, 5),
      sample_client: clients[0] ? {
        id: clients[0].id,
        name: clients[0].name || '-',
        phone: maskPhone(clients[0].phone_e164),
        status: clients[0].status,
      } : null,
    },
  }

  fs.writeFileSync(path.join(OUT_DIR, 'validation-report.json'), JSON.stringify(report, null, 2), { mode: 0o600 })
  console.log(`[validate] counts=${JSON.stringify(report.counts)}`)
  console.log(`[validate] risks=${JSON.stringify(report.risks)}`)
}

main()
