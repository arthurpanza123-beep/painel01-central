#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.resolve(ROOT, process.env.MIGRATION_OUTPUT_DIR || '.migration-output')

function read(name, fallback) {
  const file = path.join(OUT_DIR, name)
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function main() {
  const legacy = read('legacy-supabase.json', { tables: {} })
  const local = read('local-json.json', { file_counts: {} })
  const normalized = read('normalized.json', { tables: {}, diagnostics: {} })
  const validation = read('validation-report.json', { risks: {}, examples_masked: {} })
  const duplicates = read('duplicates-report.json', { phone_groups: [], username_groups: [] })
  const reminderOrphans = read('reminders-orphans.json', { count: 0, rows: [] })
  const welcomeOrphans = read('welcome-orphans.json', { count: 0, rows: [] })
  const manualReview = read('manual-review-required.json', { source_counts: {} })
  const largestPhoneGroup = [...(duplicates.phone_groups || [])].sort((a, b) => (b.count || 0) - (a.count || 0))[0] || null

  const summary = {
    generated_at: new Date().toISOString(),
    legacy_counts: Object.fromEntries(Object.entries(legacy.tables || {}).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 0])),
    local_counts: local.file_counts || {},
    normalized_counts: Object.fromEntries(Object.entries(normalized.tables || {}).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 0])),
    diagnostics: normalized.diagnostics || {},
    risks: validation.risks || {},
    duplicate_report: {
      phone_groups: (duplicates.phone_groups || []).length,
      username_groups: (duplicates.username_groups || []).length,
      largest_phone_group: largestPhoneGroup ? {
        phone: largestPhoneGroup.key_masked,
        count: largestPhoneGroup.count,
        canonical_legacy_id: largestPhoneGroup.canonical_legacy_id,
        canonical_reason: largestPhoneGroup.canonical_reason,
        large_group_analysis: largestPhoneGroup.large_group_analysis,
        sample_masked: largestPhoneGroup.sample_masked || [],
      } : null,
    },
    reminder_orphans: {
      count: reminderOrphans.count || 0,
      sample_masked: (reminderOrphans.rows || []).slice(0, 10),
    },
    welcome_orphans: {
      count: welcomeOrphans.count || 0,
      sample_masked: (welcomeOrphans.rows || []).slice(0, 10),
    },
    manual_review_required: {
      source_counts: manualReview.source_counts || {},
      duplicates_by_phone_critical: (manualReview.duplicates_by_phone_critical || []).length,
      duplicates_by_username_critical: (manualReview.duplicates_by_username_critical || []).length,
      accounts_suspeitas: (manualReview.accounts_suspeitas || []).length,
      clients_sem_telefone: (manualReview.clients_sem_telefone || []).length,
      welcome_orphans_que_parecem_clientes_reais: (manualReview.welcome_orphans_que_parecem_clientes_reais || []).length,
    },
    examples_masked: validation.examples_masked || {},
    next_step: 'Aguardando aprovacao para revisar mapeamento e liberar importacao staging.',
  }

  fs.writeFileSync(path.join(OUT_DIR, 'migration-summary.json'), JSON.stringify(summary, null, 2), { mode: 0o600 })
  console.log(JSON.stringify(summary, null, 2))
}

main()
