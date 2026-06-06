import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { effectiveTestExpiresAt, readOperationalSettings } from '@/lib/services/operational-settings'

type JsonRecord = Record<string, unknown>

function safeMetadata(metadata: JsonRecord | null | undefined): JsonRecord {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
}

function metadataString(metadata: JsonRecord, key: string): string {
  const value = metadata[key]
  return typeof value === 'string' ? value : ''
}

function isOperatorNoticeSent(metadata: JsonRecord): boolean {
  return Boolean(metadataString(metadata, 'operator_expired_notice_sent_at')) || metadataString(metadata, 'operator_expired_notice_status') === 'sent'
}

function isDue(row: {
  activated_at: string | null
  requested_at: string | null
  created_at: string | null
  expires_at: string | null
  legacy_metadata?: JsonRecord | null
}, nowMs: number, settings: Awaited<ReturnType<typeof readOperationalSettings>>) {
  const dueMs = new Date(effectiveTestExpiresAt(row, settings).expiresAt).getTime()
  return Number.isFinite(dueMs) && dueMs <= nowMs
}

export async function POST(req: NextRequest) {
  const secret = process.env.EXPIRE_DUE_SECRET || process.env.INTERNAL_API_SECRET || ''
  if (secret) {
    const provided = req.headers.get('x-internal-secret') || req.nextUrl.searchParams.get('secret') || ''
    if (provided !== secret) {
      return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: 'Token interno invalido.' }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => null) as { dryRun?: boolean; limit?: number } | null
  const db = getSupabaseServerClient()
  if (!db) return NextResponse.json({ ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase server env ausente.' }, { status: 500 })

  const limit = Math.max(1, Math.min(Number(body?.limit || 20), 50))
  const settings = await readOperationalSettings()
  const { data, error } = await db
    .from('tests')
    .select('id,status,activated_at,requested_at,created_at,expires_at,legacy_metadata')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(Math.max(limit, 100))

  if (error) return NextResponse.json({ ok: false, code: 'TEST_LOOKUP_FAILED', message: error.message }, { status: 500 })

  const nowMs = Date.now()
  const candidates = (data || [])
    .filter((row) => isDue(row as { activated_at: string | null; requested_at: string | null; created_at: string | null; expires_at: string | null; legacy_metadata?: JsonRecord | null }, nowMs, settings))
    .filter((row) => !isOperatorNoticeSent(safeMetadata((row as { legacy_metadata?: JsonRecord | null }).legacy_metadata)))
    .slice(0, limit)

  if (body?.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      code: 'EXPIRE_DUE_PREVIEW',
      count: candidates.length,
      test_ids: candidates.map((row) => row.id),
    })
  }

  const results = []
  for (const row of candidates) {
    const response = await fetch(new URL('/api/tests/expire', req.nextUrl.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test_id: row.id,
        confirm_expire: true,
        operator_ref: 'painel_web_expire_due',
        source: 'auto',
      }),
    })
    const result = await response.json().catch(() => ({ ok: false, code: 'INVALID_RESPONSE' }))
    results.push({ test_id: row.id, status: response.status, result })
  }

  return NextResponse.json({
    ok: true,
    code: 'EXPIRE_DUE_PROCESSED',
    count: results.length,
    results,
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
