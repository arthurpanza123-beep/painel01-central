import { maskSensitiveText } from '@/lib/services/masking'

import type { ProviderTestResult } from '../types'

type YellowBoxInput = {
  client_name: string
  phone: string
  app_key: string
  device_key?: string
}

type JsonRecord = Record<string, unknown>

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }
  return ''
}

function sanitizeUrl(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\\\//g, '/')
    .replace(/[)>}\].,;]+$/g, '')
}

function cleanCredential(value: unknown): string {
  const cleaned = String(value || '')
    .replace(/\\n|\\r/g, ' ')
    .replace(/[\r\n|?`*_]+/g, ' ')
    .split('&')[0]
    .trim()
  const token = cleaned.match(/[A-Za-z0-9._@+-]+/)
  return token ? token[0] : cleaned
}

function parseJson(raw: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : null
  } catch {
    return null
  }
}

function nestedRecord(payload: JsonRecord | null): JsonRecord {
  const data = payload?.data
  return data && typeof data === 'object' && !Array.isArray(data) ? data as JsonRecord : {}
}

function nestedText(payload: JsonRecord | null): string {
  if (!payload) return ''
  const data = payload.data
  return firstText(
    payload.reply,
    payload.message,
    payload.text,
    payload.result,
    payload.output,
    typeof data === 'string' ? data : '',
    data && typeof data === 'object' && !Array.isArray(data) ? nestedText(data as JsonRecord) : '',
  )
}

function lineValue(text: string, regex: RegExp): string {
  const lines = text.split(/\n/)
  for (const line of lines) {
    const clean = line.replace(/[>*_`|]/g, ' ').trim()
    const match = clean.match(regex)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

function urlAfterLabel(text: string, label: RegExp): string {
  const lines = text.split(/\n/)
  for (let index = 0; index < lines.length; index += 1) {
    if (!label.test(lines[index])) continue
    const sameLine = lines[index].match(/https?:\/\/\S+/i)
    if (sameLine?.[0]) return sanitizeUrl(sameLine[0])
    for (let next = index + 1; next < Math.min(lines.length, index + 4); next += 1) {
      const found = lines[next].match(/https?:\/\/\S+/i)
      if (found?.[0]) return sanitizeUrl(found[0])
    }
  }
  return ''
}

function normalizeExpires(value: string): string {
  const raw = value.trim()
  if (raw) {
    const brDateTime = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
    const parsed = brDateTime
      ? new Date(`${brDateTime[3]}-${brDateTime[2]}-${brDateTime[1]}T${brDateTime[4] || '23'}:${brDateTime[5] || '59'}:00.000-03:00`)
      : new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  const fallback = new Date()
  fallback.setHours(fallback.getHours() + 2)
  return fallback.toISOString()
}

function hostFromM3u(m3u: string): string {
  if (!m3u) return ''
  try {
    const url = new URL(m3u)
    return `${url.protocol}//${url.host}`
  } catch {
    return ''
  }
}

function parseYellowBoxResponse(raw: string): ProviderTestResult {
  const payload = parseJson(raw)
  const nested = nestedRecord(payload)
  const source = { ...(payload || {}), ...nested }
  const text = [raw, nestedText(payload)].filter(Boolean).join('\n')

  const username = cleanCredential(firstText(
    source.username,
    source.user,
    source.login,
    source.usuario,
    lineValue(text, /(?:usuario|usuário|user|login)\s*[:=-]\s*([A-Za-z0-9._@+-]+)/i),
    text.match(/username=([^&\s]+)/i)?.[1],
  ))
  const password = cleanCredential(firstText(
    source.password,
    source.pass,
    source.senha,
    lineValue(text, /(?:senha|password|pass)\s*[:=-]\s*([A-Za-z0-9._@+-]+)/i),
    text.match(/password=([^&\s]+)/i)?.[1],
  ))
  const m3u = sanitizeUrl(firstText(
    source.m3u,
    source.m3u_url,
    source.m3uUrl,
    source.playlist,
    source.playlist_url,
    urlAfterLabel(text, /link\s*(?:\(\s*m3u\s*\)|m3u)\s*:?/i),
    text.match(/(https?:\/\/[^\s\n]+get\.php\?[^\s\n]+)/i)?.[1],
  ))
  const hls = sanitizeUrl(firstText(
    source.hls,
    source.hls_url,
    source.hlsUrl,
    source.m3u8,
    source.stream_url,
    lineValue(text, /(?:hls|m3u8)\s*[:=-]\s*(https?:\/\/[^\s\n]+)/i),
  ))
  const dns = sanitizeUrl(firstText(source.dns, source.host, source.server, source.servidor, source.url, source.domain))
  const host = firstText(dns, hostFromM3u(m3u))
  const expires = firstText(source.expires_at, source.expiresAt, source.expire_at, source.expiration, source.vencimento, source.validade, source.expires)
  const providerCode = firstText(source.provider_code, source.providerCode, source.codigo_provedor, source.appCode, lineValue(text, /(?:codigo|c[oó]digo)\s*\/?\s*(?:provedor)?\s*[:=-]\s*([A-Za-z0-9._-]+)/i))
  const orderId = firstText(source.order_id, source.orderId, source.pedido, source.request_id, source.id)

  if (!username || !password) {
    throw new Error('Yellow Box retornou payload sem usuario/senha.')
  }

  return {
    order_id: orderId || undefined,
    host: host || undefined,
    username,
    password,
    provider_code: providerCode || undefined,
    dns: dns || undefined,
    expires_at: normalizeExpires(expires),
    optional_m3u_url: m3u || undefined,
    optional_hls_url: hls || undefined,
    raw_provider_response: {
      provider: 'yellow_box',
      parsed_from: payload ? 'json' : 'text',
      raw_text: raw,
    },
  }
}

export async function createYellowBoxTest(input: YellowBoxInput): Promise<ProviderTestResult> {
  const apiUrl = String(process.env.YELLOW_BOX_API_URL || process.env.BRASILTV_API_URL || '').trim()
  const apiKey = String(process.env.YELLOW_BOX_API_KEY || '').trim()
  const timeoutMs = Math.max(Number(process.env.YELLOW_BOX_TIMEOUT_MS || 30000), 1000)

  if (!apiUrl) throw new Error('YELLOW_BOX_API_URL nao configurada.')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
      headers['x-api-key'] = apiKey
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
      signal: controller.signal,
    })
    const raw = await response.text()
    if (!response.ok) {
      throw new Error(`Yellow Box HTTP ${response.status}: ${maskSensitiveText(raw.slice(0, 300))}`)
    }
    return parseYellowBoxResponse(raw)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Yellow Box timeout apos ${timeoutMs}ms.`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
