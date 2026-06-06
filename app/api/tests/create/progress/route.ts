import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseServerClient } from '@/lib/supabase/server'

type LogRow = {
  id: string
  scope: string
  level: string | null
  event: string
  test_id: string | null
  message: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
}

const STEP_DEFS = [
  { id: 'validando', label: 'Validando cliente', start: ['TEST_CREATE_STARTED'], done: ['TEST_PROVIDER_SELECTED'] },
  { id: 'acesso', label: 'Gerando acesso', start: ['YELLOW_BOX_TEST_START'], done: ['YELLOW_BOX_TEST_OK', 'TEST_CREATED'] },
  { id: 'playlist', label: 'Obtendo playlist', start: ['YELLOW_BOX_TEST_OK'], done: ['TEST_CREATED', 'XCLOUD_WORKER_STARTED'] },
  { id: 'dispositivo', label: 'Criando device XCloud', start: ['XCLOUD_WORKER_STARTED', 'XCLOUD_DEVICE_LIST_REFRESHED'], done: ['XCLOUD_DEVICE_ADDED', 'XCLOUD_DEVICE_ROW_FOUND', 'XCLOUD_DEVICE_READY_FOR_XTREAM'] },
  { id: 'servidor', label: 'Vinculando servidor Xtream', start: ['XCLOUD_XTREAM_ATTACH_STARTED'], done: ['XCLOUD_XTREAM_ATTACHED'] },
  { id: 'reload', label: 'Confirmando RELOAD', start: ['XCLOUD_XTREAM_ATTACHED'], done: ['XCLOUD_WORKER_COMPLETED', 'XCLOUD_RECREATE_CONFIRMED'] },
  { id: 'mensagem', label: 'Enviando mensagem', start: ['XCLOUD_WORKER_COMPLETED', 'XCLOUD_RECREATE_CONFIRMED', 'TEST_CREATED', 'TEST_MESSAGE_DISPATCH_STARTED'], done: ['TEST_MESSAGE_SENT', 'TEST_MESSAGE_DISPATCH_FAILED', 'TEST_MESSAGE_PREPARED'] },
  { id: 'concluido', label: 'Concluído', start: ['TEST_MESSAGE_PREPARED'], done: ['TEST_MESSAGE_PREPARED'] },
]

function eventSet(logs: LogRow[]) {
  return new Set(logs.map((log) => log.event))
}

function stepStatus(def: (typeof STEP_DEFS)[number], events: Set<string>, failedEvent?: LogRow | null) {
  if (failedEvent && def.start.some((event) => events.has(event)) && !def.done.some((event) => events.has(event))) return 'failed'
  if (def.done.some((event) => events.has(event))) return 'done'
  if (def.start.some((event) => events.has(event))) return 'running'
  return 'pending'
}

export async function GET(req: NextRequest) {
  const operatorRef = req.nextUrl.searchParams.get('operator_ref') || ''
  if (!operatorRef) {
    return NextResponse.json({ ok: false, code: 'OPERATOR_REF_REQUIRED', message: 'operator_ref obrigatorio.' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  if (!db) return NextResponse.json({ ok: false, code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase ausente.' }, { status: 500 })

  const byOperator = await db
    .from('logs')
    .select('id,scope,level,event,test_id,message,metadata,created_at')
    .filter('metadata->>operator_ref', 'eq', operatorRef)
    .order('created_at', { ascending: true })
    .limit(100)

  if (byOperator.error) return NextResponse.json({ ok: false, code: 'LOG_LOOKUP_FAILED', message: byOperator.error.message }, { status: 500 })

  const operatorLogs = (byOperator.data || []) as LogRow[]
  const testId = operatorLogs.find((log) => log.test_id)?.test_id || null
  let logs = operatorLogs

  if (testId) {
    const byTest = await db
      .from('logs')
      .select('id,scope,level,event,test_id,message,metadata,created_at')
      .eq('test_id', testId)
      .order('created_at', { ascending: true })
      .limit(200)
    if (byTest.error) return NextResponse.json({ ok: false, code: 'TEST_LOG_LOOKUP_FAILED', message: byTest.error.message }, { status: 500 })
    const seen = new Set(operatorLogs.map((log) => log.id))
    logs = [...operatorLogs, ...((byTest.data || []) as LogRow[]).filter((log) => !seen.has(log.id))]
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
  }

  const events = eventSet(logs)
  const failedEvent = logs.find((log) => log.level === 'error' || (log.level !== 'warning' && /FAILED|ERROR/i.test(log.event))) || null
  const steps = STEP_DEFS.map((def) => ({
    id: def.id,
    label: def.label,
    status: stepStatus(def, events, failedEvent),
  }))
  const current = steps.find((step) => step.status === 'running') || steps.find((step) => step.status === 'failed') || steps.find((step) => step.status === 'pending') || steps[steps.length - 1]

  return NextResponse.json({
    ok: true,
    operator_ref: operatorRef,
    test_id: testId,
    status: failedEvent ? 'failed' : events.has('TEST_MESSAGE_PREPARED') ? 'success' : 'running',
    current_step: current,
    failed_event: failedEvent ? { event: failedEvent.event, message: failedEvent.message } : null,
    steps,
    events: logs.map((log) => ({ event: log.event, level: log.level, scope: log.scope, created_at: log.created_at })),
  })
}
