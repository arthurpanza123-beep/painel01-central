#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const BOT_ROOT = process.env.LEGACY_BOT_ROOT || '/opt/centralplay-plus/apps/bot-telegram'
const OUT_DIR = path.resolve(ROOT, process.env.MIGRATION_OUTPUT_DIR || '.migration-output')
const TABLES = ['clients', 'reminders', 'sales', 'meta_conversion_events']

function arg(name) {
  return process.argv.includes(name)
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
}

function readEnv(file) {
  const env = {}
  if (!fs.existsSync(file)) return env
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function mask(value) {
  const text = String(value || '')
  if (!text) return ''
  return text.length <= 8 ? '***' : `${text.slice(0, 4)}***${text.slice(-4)}`
}

async function readTable(base, key, table) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const url = `${base}/rest/v1/${table}?select=*`
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${to}`,
        'Content-Type': 'application/json',
      },
    })
    const text = await res.text()
    let body = []
    if (text) {
      try {
        body = JSON.parse(text)
      } catch (_) {
        throw new Error(`Resposta invalida em ${table}: HTTP ${res.status}`)
      }
    }
    if (!res.ok) throw new Error(`Falha lendo ${table}: HTTP ${res.status}`)
    if (!Array.isArray(body) || body.length === 0) break
    rows.push(...body)
    if (body.length < pageSize) break
  }
  return rows
}

async function main() {
  const dryRun = arg('--dry-run') || !arg('--execute')
  ensureDir(OUT_DIR)

  const botEnv = readEnv(path.join(BOT_ROOT, '.env'))
  const base = String(process.env.LEGACY_SUPABASE_URL || botEnv.SUPABASE_URL || '').replace(/\/+$/, '')
  const key = process.env.LEGACY_SUPABASE_SERVICE_ROLE_KEY || botEnv.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!base || !key) throw new Error('Supabase antigo nao configurado no .env do bot ou env LEGACY_*.')

  console.log(`[export-legacy-supabase] modo=${dryRun ? 'dry-run' : 'execute'} base=${mask(base)} key=${mask(key)}`)
  const output = {
    exported_at: new Date().toISOString(),
    source: 'legacy_supabase',
    dry_run: dryRun,
    tables: {},
  }

  for (const table of TABLES) {
    const rows = await readTable(base, key, table)
    output.tables[table] = rows
    console.log(`[export-legacy-supabase] ${table}: ${rows.length}`)
  }

  const file = path.join(OUT_DIR, 'legacy-supabase.json')
  fs.writeFileSync(file, JSON.stringify(output, null, 2), { mode: 0o600 })
  console.log(`[export-legacy-supabase] arquivo=${file}`)
}

main().catch((err) => {
  console.error(`[export-legacy-supabase] erro: ${err.message || String(err)}`)
  process.exitCode = 1
})
