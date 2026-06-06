import fs from 'fs'
import path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
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

const intervalMs = Math.max(60_000, Number(process.env.EXPIRE_DUE_INTERVAL_MS || 5 * 60_000))
const endpoint = process.env.EXPIRE_DUE_ENDPOINT || 'http://127.0.0.1:3001/api/tests/expire-due'
const secret = process.env.EXPIRE_DUE_SECRET || process.env.INTERNAL_API_SECRET || ''

async function tick() {
  const startedAt = new Date().toISOString()
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-internal-secret': secret } : {}),
      },
      body: JSON.stringify({ limit: Number(process.env.EXPIRE_DUE_LIMIT || 20) }),
    })
    const payload = await response.json().catch(() => ({ ok: false, code: 'INVALID_RESPONSE' }))
    console.log(`[EXPIRE_DUE_CRON] ${JSON.stringify({ startedAt, status: response.status, ok: payload.ok, code: payload.code, count: payload.count || 0 })}`)
  } catch (error) {
    console.error(`[EXPIRE_DUE_CRON_FAILED] ${JSON.stringify({ startedAt, error: error instanceof Error ? error.message : String(error) })}`)
  }
}

await tick()
setInterval(tick, intervalMs)
