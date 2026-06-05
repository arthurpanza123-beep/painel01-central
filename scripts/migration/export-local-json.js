#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const BOT_ROOT = process.env.LEGACY_BOT_ROOT || '/opt/centralplay-plus/apps/bot-telegram'
const OUT_DIR = path.resolve(ROOT, process.env.MIGRATION_OUTPUT_DIR || '.migration-output')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return []
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch (_) {
        return { parse_error: true, raw_length: line.length }
      }
    })
}

function maybeRead(file) {
  if (!fs.existsSync(file)) return null
  return readJson(file, null)
}

function countRecords(value) {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object' && value.contacts && typeof value.contacts === 'object') {
    return Object.keys(value.contacts).length
  }
  if (value && typeof value === 'object') return Object.keys(value).length
  return 0
}

function main() {
  ensureDir(OUT_DIR)
  const dataDir = path.join(BOT_ROOT, 'data')
  const backupsDir = path.join(BOT_ROOT, 'backups')
  const usefulBackups = [
    '20260601-162645-pre-fix/clients-before.json',
    '20260601-162645-pre-fix/reminders-before.json',
  ]

  const output = {
    exported_at: new Date().toISOString(),
    source: 'legacy_local_files',
    files: {
      welcome_state: readJson(path.join(dataDir, 'welcome-state.json'), {}),
      history: readJsonl(path.join(dataDir, 'history.jsonl')),
      backups: {},
    },
    file_counts: {},
  }

  for (const rel of usefulBackups) {
    output.files.backups[rel] = maybeRead(path.join(backupsDir, rel))
  }

  output.file_counts.welcome_state = countRecords(output.files.welcome_state)
  output.file_counts.history = output.files.history.length
  for (const [rel, value] of Object.entries(output.files.backups)) {
    output.file_counts[`backup:${rel}`] = countRecords(value)
  }

  const file = path.join(OUT_DIR, 'local-json.json')
  fs.writeFileSync(file, JSON.stringify(output, null, 2), { mode: 0o600 })
  console.log(`[export-local-json] arquivo=${file}`)
  console.log(`[export-local-json] welcome=${output.file_counts.welcome_state} history=${output.file_counts.history}`)
}

main()
