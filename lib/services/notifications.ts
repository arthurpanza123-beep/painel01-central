import { maskSensitiveText } from '@/lib/services/masking'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type JsonRecord = Record<string, unknown>

export type PanelNotification = {
  id: string
  key: string
  type: 'test_created' | 'test_expired' | 'test_activated' | 'client_expiring_tomorrow'
  title: string
  body: string
  client_id?: string | null
  test_id?: string | null
  created_at: string
  read: boolean
  metadata: JsonRecord
}

function db() {
  return getSupabaseServerClient()
}

function safeMetadata(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) => (
    typeof item === 'string' ? maskSensitiveText(item) : item
  ))) as JsonRecord
}

function operationDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return { year: pick('year'), month: pick('month'), day: pick('day'), hour: pick('hour'), minute: pick('minute') }
}

function dayIso(offsetDays = 0, end = false) {
  const base = new Date()
  const parts = operationDateParts(base)
  const date = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00-03:00`)
  date.setDate(date.getDate() + offsetDays)
  if (end) date.setHours(23, 59, 59, 999)
  return date.toISOString()
}

async function existingNotificationKeys(keys: string[]) {
  const database = db()
  if (!database || !keys.length) return new Set<string>()
  const { data } = await database
    .from('logs')
    .select('metadata')
    .eq('scope', 'notification')
    .in('event', keys)
  return new Set((data || []).map((row: { metadata?: JsonRecord | null }) => String(row.metadata?.notification_key || '')).filter(Boolean))
}

async function insertNotification(input: Omit<PanelNotification, 'id' | 'created_at' | 'read' | 'metadata'> & { metadata?: JsonRecord }) {
  const database = db()
  if (!database) return
  const exists = await existingNotificationKeys([input.key])
  if (exists.has(input.key)) return
  await database.from('logs').insert({
    scope: 'notification',
    level: 'info',
    event: input.key,
    client_id: input.client_id || null,
    test_id: input.test_id || null,
    message: input.body,
    metadata: safeMetadata({
      ...(input.metadata || {}),
      notification_key: input.key,
      notification_type: input.type,
      title: input.title,
      body: input.body,
      read: false,
    }),
  }).then(() => null)
}

async function generateLifecycleNotifications() {
  const database = db()
  if (!database) return
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [testsRes, eventsRes] = await Promise.all([
    database
      .from('tests')
      .select('id,client_id,status,expires_at,created_at,clients(name)')
      .or(`created_at.gte.${since},expires_at.gte.${since}`)
      .limit(200),
    database
      .from('pipeline_events')
      .select('id,entity_id,event_type,payload,created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  for (const test of (testsRes.data || []) as Array<{ id: string; client_id: string | null; status: string | null; expires_at: string | null; created_at: string | null; clients?: { name?: string | null } | { name?: string | null }[] | null }>) {
    const client = Array.isArray(test.clients) ? test.clients[0] : test.clients
    const name = client?.name || 'Cliente'
    await insertNotification({
      key: `test_created:${test.id}`,
      type: 'test_created',
      title: 'Teste gerado',
      body: `Teste gerado com sucesso para ${name}.`,
      client_id: test.client_id,
      test_id: test.id,
      metadata: { test_status: test.status },
    })
    const expired = test.expires_at && new Date(test.expires_at).getTime() <= Date.now()
    if (expired || test.status === 'expired') {
      await insertNotification({
        key: `test_expired:${test.id}`,
        type: 'test_expired',
        title: 'Teste expirado',
        body: `O teste de ${name} expirou.`,
        client_id: test.client_id,
        test_id: test.id,
        metadata: { expires_at: test.expires_at },
      })
    }
  }

  for (const event of (eventsRes.data || []) as Array<{ id: string; entity_id: string; event_type: string | null; payload: JsonRecord | null }>) {
    const type = String(event.event_type || '').toLowerCase()
    if (!/(test_converted|paid_activation_completed|access_activated|activation)/.test(type)) continue
    await insertNotification({
      key: `test_activated:${event.id}`,
      type: 'test_activated',
      title: 'Teste ativado',
      body: 'Um teste virou cliente ativo.',
      client_id: event.entity_id,
      test_id: typeof event.payload?.test_id === 'string' ? event.payload.test_id : null,
      metadata: { event_type: event.event_type },
    })
  }
}

async function generateExpiringTomorrowNotifications() {
  const database = db()
  if (!database) return
  const nowParts = operationDateParts()
  const slots = ['09', '12', '17']
  if (!slots.includes(nowParts.hour)) return

  const slot = `${nowParts.hour}:00`
  const tomorrowStart = dayIso(1)
  const tomorrowEnd = dayIso(1, true)
  const { data } = await database
    .from('renewals')
    .select('id,client_id,due_at,status,clients(id,name,status)')
    .gte('due_at', tomorrowStart)
    .lte('due_at', tomorrowEnd)
    .not('status', 'in', '("paid","cancelled")')
    .limit(300)

  for (const renewal of (data || []) as Array<{ id: string; client_id: string; due_at: string; status: string | null; clients?: { id?: string; name?: string | null; status?: string | null } | { id?: string; name?: string | null; status?: string | null }[] | null }>) {
    const client = Array.isArray(renewal.clients) ? renewal.clients[0] : renewal.clients
    if (client?.status !== 'active') continue
    const name = client.name || 'Cliente'
    const dueDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(renewal.due_at))
    await insertNotification({
      key: `client_expiring_tomorrow:${renewal.client_id}:${dueDate}:${slot}`,
      type: 'client_expiring_tomorrow',
      title: 'Cliente expira amanhã',
      body: `O cliente ${name} expira amanhã. Verifique a renovação.`,
      client_id: renewal.client_id,
      test_id: null,
      metadata: { due_at: renewal.due_at, scheduled_slot: slot },
    })
  }
}

export async function refreshPanelNotifications() {
  await generateLifecycleNotifications()
  await generateExpiringTomorrowNotifications()
}

export async function listPanelNotifications(): Promise<PanelNotification[]> {
  const database = db()
  if (!database) return []
  await refreshPanelNotifications()
  const { data, error } = await database
    .from('logs')
    .select('id,event,message,client_id,test_id,metadata,created_at')
    .eq('scope', 'notification')
    .order('created_at', { ascending: false })
    .limit(80)
  if (error) throw new Error(error.message)
  return ((data || []) as Array<{ id: string; event: string; message: string | null; client_id: string | null; test_id: string | null; metadata: JsonRecord | null; created_at: string }>).map((row) => ({
    id: row.id,
    key: String(row.metadata?.notification_key || row.event),
    type: String(row.metadata?.notification_type || 'test_created') as PanelNotification['type'],
    title: String(row.metadata?.title || 'Notificação'),
    body: String(row.metadata?.body || row.message || ''),
    client_id: row.client_id,
    test_id: row.test_id,
    created_at: row.created_at,
    read: row.metadata?.read === true,
    metadata: row.metadata || {},
  }))
}

export async function markPanelNotificationsRead(ids: string[]) {
  const database = db()
  if (!database || !ids.length) return
  const { data } = await database.from('logs').select('id,metadata').in('id', ids)
  await Promise.all((data || []).map((row: { id: string; metadata?: JsonRecord | null }) =>
    database.from('logs').update({ metadata: { ...(row.metadata || {}), read: true, read_at: new Date().toISOString() } }).eq('id', row.id)
  ))
}
