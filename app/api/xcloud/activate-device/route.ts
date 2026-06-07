import { NextRequest, NextResponse } from 'next/server'

import { runXcloudWorker, xcloudWorkerErrorResponse } from '@/lib/services/xcloud-worker'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type JsonRecord = Record<string, unknown>

async function markRetrySucceeded(testId: string, result: JsonRecord) {
  const db = getSupabaseServerClient()
  if (!db) return

  const { data } = await db
    .from('tests')
    .select('client_id,status,legacy_metadata')
    .eq('id', testId)
    .maybeSingle()

  const row = data as { client_id: string | null; status: string | null; legacy_metadata: JsonRecord | null } | null
  if (!row || row.status === 'expired' || row.status === 'cancelled') return

  const metadata = row.legacy_metadata || {}
  const currentDispatch = metadata.dispatch && typeof metadata.dispatch === 'object' && !Array.isArray(metadata.dispatch)
    ? metadata.dispatch as JsonRecord
    : {}
  const dispatchAlreadySent = ['sent', 'dry_run'].includes(String(currentDispatch.status || '').toLowerCase()) || currentDispatch.ok === true
  const now = new Date().toISOString()
  await db.from('tests').update({
    status: 'active',
    failed_at: null,
    legacy_metadata: {
      ...metadata,
      xcloud_worker: {
        ...((metadata.xcloud_worker && typeof metadata.xcloud_worker === 'object' && !Array.isArray(metadata.xcloud_worker)) ? metadata.xcloud_worker as JsonRecord : {}),
        ...result,
        status: 'success',
        updated_at: now,
      },
      dispatch: dispatchAlreadySent ? currentDispatch : {
        ...currentDispatch,
        status: 'pending_manual_send',
        ok: false,
        dry_run: false,
        code: 'XCLOUD_READY_SEND_PENDING',
        message: 'XCloud concluido; mensagem aguardando envio pelo operador.',
        updated_at: now,
      },
    },
  }).eq('id', testId)

  if (row.client_id) {
    await db.from('clients').update({ status: 'test_active' }).eq('id', row.client_id).neq('status', 'active')
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await runXcloudWorker(body)
    if (body?.test_id && result.status === 'success' && body?.mode !== 'remove_device') {
      await markRetrySucceeded(String(body.test_id), result as unknown as JsonRecord).catch(() => null)
    }
    return NextResponse.json({ success: result.status !== 'failed', ...result }, { status: result.status === 'failed' ? 500 : 200 })
  } catch (error) {
    const response = xcloudWorkerErrorResponse(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
