import { MOCK_RENOVACOES, type Renovacao } from '@/lib/mock-data'
import { formatDateBR, daysUntil } from '@/lib/services/date-normalizer'
import { maskPhone } from '@/lib/services/masking'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export type RenewalsQueryResult = {
  data_source: 'mock' | 'supabase'
  items: Renovacao[]
}

type ClientRow = { id: string; name: string | null; phone_e164: string | null }
type RenewalRow = { id: string; client_id: string; plan_key: string | null; amount_cents: number | null; status: string | null; due_at: string | null }

function mapStatus(status: string | null): Renovacao['status'] {
  if (status === 'paid') return 'pago'
  if (status === 'overdue') return 'atrasado'
  return 'pendente'
}

function buildMockItems(): Renovacao[] {
  return MOCK_RENOVACOES.map((row) => ({ ...row, telefone: maskPhone(row.telefone) }))
}

function planLabel(planKey: string | null): string {
  const key = String(planKey || '').toLowerCase()
  if (key === 'mensal') return 'Mensal'
  if (key === 'trimestral') return 'Trimestral'
  if (key === 'semestral') return 'Semestral'
  if (key === 'anual') return 'Anual'
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Mensal'
}

export async function getRenewalsData(): Promise<RenewalsQueryResult> {
  if (!isSupabaseServerConfigured) return { data_source: 'mock', items: buildMockItems() }
  const db = getSupabaseServerClient()
  if (!db) return { data_source: 'mock', items: buildMockItems() }

  try {
    const [renewalsRes, clientsRes] = await Promise.all([
      db.from('renewals').select('id,client_id,plan_key,amount_cents,status,due_at').order('due_at', { ascending: true }),
      db.from('clients').select('id,name,phone_e164'),
    ])

    if (renewalsRes.error) throw new Error(renewalsRes.error.message)
    if (clientsRes.error) throw new Error(clientsRes.error.message)

    const clientsById = new Map((clientsRes.data as ClientRow[] || []).map((row) => [row.id, row]))

    const items: Renovacao[] = (renewalsRes.data as RenewalRow[] || []).map((renewal) => {
      const client = clientsById.get(renewal.client_id)
      const due = renewal.due_at || new Date().toISOString()
      const amount = Number(((renewal.amount_cents || 0) / 100).toFixed(2))
      return {
        id: renewal.id,
        clienteId: renewal.client_id,
        cliente: client?.name || 'Cliente',
        telefone: maskPhone(client?.phone_e164 || ''),
        plano: planLabel(renewal.plan_key),
        valor: amount,
        vencimento: formatDateBR(due),
        status: mapStatus(renewal.status),
        diasRestantes: daysUntil(due),
      }
    })

    return { data_source: 'supabase', items }
  } catch {
    return { data_source: 'mock', items: buildMockItems() }
  }
}
