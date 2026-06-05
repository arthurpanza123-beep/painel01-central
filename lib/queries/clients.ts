import crypto from 'crypto'

import { MOCK_CLIENTES, type Cliente } from '@/lib/mock-data'
import { maskPassword, maskPhone, maskUsername } from '@/lib/services/masking'
import { formatDateBR } from '@/lib/services/date-normalizer'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export type ClientsQueryResult = {
  data_source: 'mock' | 'supabase'
  items: Cliente[]
}

type ClientRow = {
  id: string
  name: string | null
  phone_e164: string | null
  status: string | null
  source: string | null
  created_at: string | null
}

type AccountRow = {
  id: string
  client_id: string | null
  username: string | null
  password_secret: string | null
  max_slots: number | null
  status: string | null
  expires_at: string | null
  panel_external_id: string | null
  provider: string | null
  provider_code: string | null
  app_id: string | null
  panel_id: string | null
  legacy_metadata: Record<string, unknown> | null
}

type RenewalRow = {
  id: string
  client_id: string | null
  plan_key: string | null
  amount_cents: number | null
  status: string | null
  due_at: string | null
}

type AppRow = {
  id: string
  name: string
  key: string
}

type PanelRow = {
  id: string
  name: string
  key: string
}

function codeFromSeed(seed: string): string {
  const n = parseInt(crypto.createHash('sha1').update(seed).digest('hex').slice(0, 8), 16) % 10000
  return `#${String(n).padStart(4, '0')}`
}

function mapStatus(value: string | null): Cliente['status'] {
  if (value === 'active' || value === 'ativo') return 'ativo'
  if (value === 'expired' || value === 'expirado') return 'expirado'
  if (value === 'pending' || value === 'pendente' || value === 'test_active') return 'pendente'
  return 'suspenso'
}

function mapPlan(planKey: string | null, amountCents: number | null): { plano: string; valor: number } {
  const key = String(planKey || '').toLowerCase()
  const plano =
    key === 'mensal' ? 'Mensal' :
    key === 'trimestral' ? 'Trimestral' :
    key === 'semestral' ? 'Semestral' :
    key === 'anual' ? 'Anual' :
    key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Mensal'
  return { plano, valor: Number(((amountCents || 0) / 100).toFixed(2)) }
}

function buildMockItems(): Cliente[] {
  return MOCK_CLIENTES.map((cliente) => ({
    ...cliente,
    telefone: maskPhone(cliente.telefone),
    senha: maskPassword(cliente.senha),
    usuario: maskUsername(cliente.usuario),
  }))
}

export async function getClientsData(): Promise<ClientsQueryResult> {
  if (!isSupabaseServerConfigured) {
    return { data_source: 'mock', items: buildMockItems() }
  }

  const db = getSupabaseServerClient()
  if (!db) return { data_source: 'mock', items: buildMockItems() }

  try {
    const [clientsRes, accountsRes, renewalsRes, appsRes, panelsRes] = await Promise.all([
      db.from('clients').select('id,name,phone_e164,status,source,created_at').order('created_at', { ascending: true }),
      db.from('accounts').select('id,client_id,username,password_secret,max_slots,status,expires_at,panel_external_id,provider,provider_code,app_id,panel_id,legacy_metadata').order('created_at', { ascending: true }),
      db.from('renewals').select('id,client_id,plan_key,amount_cents,status,due_at').order('created_at', { ascending: true }),
      db.from('apps').select('id,name,key'),
      db.from('panels').select('id,name,key'),
    ])

    if (clientsRes.error) throw new Error(clientsRes.error.message)
    if (accountsRes.error) throw new Error(accountsRes.error.message)
    if (renewalsRes.error) throw new Error(renewalsRes.error.message)
    if (appsRes.error) throw new Error(appsRes.error.message)
    if (panelsRes.error) throw new Error(panelsRes.error.message)

    const appsById = new Map((appsRes.data as AppRow[] || []).map((row) => [row.id, row]))
    const panelsById = new Map((panelsRes.data as PanelRow[] || []).map((row) => [row.id, row]))
    const accountByClientId = new Map((accountsRes.data as AccountRow[] || []).map((row) => [row.client_id || '', row]))
    const renewalByClientId = new Map((renewalsRes.data as RenewalRow[] || []).map((row) => [row.client_id || '', row]))

    const items: Cliente[] = (clientsRes.data as ClientRow[] || []).map((client) => {
      const account = accountByClientId.get(client.id)
      const renewal = renewalByClientId.get(client.id)
      const app = account?.app_id ? appsById.get(account.app_id) : null
      const panel = account?.panel_id ? panelsById.get(account.panel_id) : null
      const appName = app?.name || account?.provider || 'Aplicativo'
      const serverName = panel?.name || account?.provider || 'Servidor'
      const dueDate = renewal?.due_at || account?.expires_at || client.created_at || ''
      const { plano, valor } = mapPlan(renewal?.plan_key || null, renewal?.amount_cents || null)

      return {
        id: client.id,
        nome: client.name || 'Cliente',
        telefone: maskPhone(client.phone_e164 || ''),
        app: appName,
        servidor: serverName,
        plano,
        valor,
        vencimento: formatDateBR(dueDate),
        usuario: maskUsername(account?.username || 'usuario'),
        senha: maskPassword(account?.password_secret || 'senha'),
        status: mapStatus(client.status),
        criadoEm: formatDateBR(client.created_at || new Date().toISOString()),
      }
    })

    return { data_source: 'supabase', items }
  } catch {
    return { data_source: 'mock', items: buildMockItems() }
  }
}
