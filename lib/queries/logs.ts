import { MOCK_LOGS, type LogEntry } from '@/lib/mock-data'
import { formatDateTimeBR } from '@/lib/services/date-normalizer'
import { maskSensitiveText } from '@/lib/services/masking'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export type LogsQueryResult = {
  data_source: 'mock' | 'supabase'
  items: LogEntry[]
}

type LogRow = {
  id: string
  scope: string
  level: string | null
  event: string
  message: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
}

function mapLevel(level: string | null): LogEntry['tipo'] {
  if (level === 'error') return 'erro'
  if (level === 'warning') return 'warning'
  if (level === 'success') return 'success'
  return 'info'
}

function buildMockItems(): LogEntry[] {
  return MOCK_LOGS.map((log) => ({
    ...log,
    mensagem: maskSensitiveText(log.mensagem),
    detalhes: log.detalhes ? maskSensitiveText(log.detalhes) : undefined,
  }))
}

export async function getLogsData(): Promise<LogsQueryResult> {
  if (!isSupabaseServerConfigured) return { data_source: 'mock', items: buildMockItems() }
  const db = getSupabaseServerClient()
  if (!db) return { data_source: 'mock', items: buildMockItems() }

  try {
    const logsRes = await db
      .from('logs')
      .select('id,scope,level,event,message,metadata,created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (logsRes.error) throw new Error(logsRes.error.message)

    const items: LogEntry[] = (logsRes.data as LogRow[] || []).map((log) => ({
      id: log.id,
      tipo: mapLevel(log.level),
      mensagem: maskSensitiveText(log.message || log.event),
      detalhes: maskSensitiveText(`${log.scope}${log.metadata && Object.keys(log.metadata).length ? ` | ${JSON.stringify(log.metadata)}` : ''}`),
      timestamp: formatDateTimeBR(log.created_at || new Date().toISOString()).replace(' às ', ' '),
    }))

    return { data_source: 'supabase', items }
  } catch {
    return { data_source: 'mock', items: buildMockItems() }
  }
}
