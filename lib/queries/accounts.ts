import crypto from 'crypto'

import { MOCK_CONTAS, type Conta } from '@/lib/mock-data'
import { maskPassword, maskPhone, maskUsername } from '@/lib/services/masking'
import { formatDateBR } from '@/lib/services/date-normalizer'
import { operationWindows } from '@/lib/services/operational-window'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export type AccountsQueryResult = {
  data_source: 'mock' | 'supabase'
  items: Conta[]
}

type ClientRow = { id: string; name: string | null; phone_e164: string | null; created_at: string | null }
type AccountRow = {
  id: string
  client_id: string | null
  username: string | null
  password_secret: string | null
  max_slots: number | null
  status: string | null
  activated_at: string | null
  expires_at: string | null
  provider: string | null
  provider_code: string | null
  panel_external_id: string | null
  app_id: string | null
  panel_id: string | null
  created_at: string | null
}
type SlotRow = { id: string; account_id: string; client_id: string | null; slot_number: number; status: string | null; assigned_at: string | null }
type AppRow = { id: string; name: string; key: string }
type PanelRow = { id: string; name: string; key: string }

function codeFromSeed(seed: string): string {
  const n = parseInt(crypto.createHash('sha1').update(seed).digest('hex').slice(0, 8), 16) % 10000
  return `#${String(n).padStart(4, '0')}`
}

function buildMockItems(): Conta[] {
  return MOCK_CONTAS.map((conta) => ({
    ...conta,
    usuario: maskUsername(conta.usuario),
    senha: maskPassword(conta.senha),
    telefonePrincipal: maskPhone(conta.telefonePrincipal),
    clientesVinculados: conta.clientesVinculados.map((vinc) => ({ ...vinc, telefone: maskPhone(vinc.telefone) })),
  }))
}

function resolveServer(panel: PanelRow | undefined, account: AccountRow): string {
  if (panel?.name) return panel.name
  if (account.provider === 'yellow_box') return 'Yellow Box'
  if (account.provider === 'xbr') return 'Ninety'
  if (account.provider) return account.provider
  return 'Servidor'
}

function resolveApp(app: AppRow | undefined, account: AccountRow): string {
  if (app?.name) return app.name
  const provider = String(account.provider || '').toLowerCase()
  if (provider.includes('yellow')) return 'PlaySim'
  if (provider.includes('xbr')) return 'XCloud'
  return 'XCloud'
}

export async function getAccountsData(): Promise<AccountsQueryResult> {
  if (!isSupabaseServerConfigured) return { data_source: 'mock', items: buildMockItems() }
  const db = getSupabaseServerClient()
  if (!db) return { data_source: 'mock', items: buildMockItems() }

  try {
    const [accountsRes, slotsRes, clientsRes, appsRes, panelsRes] = await Promise.all([
      db.from('accounts').select('id,client_id,username,password_secret,max_slots,status,activated_at,expires_at,provider,provider_code,panel_external_id,app_id,panel_id,created_at').order('created_at', { ascending: true }),
      db.from('account_slots').select('id,account_id,client_id,slot_number,status,assigned_at').order('slot_number', { ascending: true }),
      db.from('clients').select('id,name,phone_e164,created_at'),
      db.from('apps').select('id,name,key'),
      db.from('panels').select('id,name,key'),
    ])

    if (accountsRes.error) throw new Error(accountsRes.error.message)
    if (slotsRes.error) throw new Error(slotsRes.error.message)
    if (clientsRes.error) throw new Error(clientsRes.error.message)
    if (appsRes.error) throw new Error(appsRes.error.message)
    if (panelsRes.error) throw new Error(panelsRes.error.message)

    const clientsById = new Map((clientsRes.data as ClientRow[] || []).map((row) => [row.id, row]))
    const appsById = new Map((appsRes.data as AppRow[] || []).map((row) => [row.id, row]))
    const panelsById = new Map((panelsRes.data as PanelRow[] || []).map((row) => [row.id, row]))
    const slotsByAccountId = new Map<string, SlotRow[]>()
    for (const slot of (slotsRes.data as SlotRow[] || [])) {
      const list = slotsByAccountId.get(slot.account_id) || []
      list.push(slot)
      slotsByAccountId.set(slot.account_id, list)
    }

    const todayStart = operationWindows().todayStartIso
    const mapped = (accountsRes.data as AccountRow[] || []).map((account) => {
      const linkedSlots = slotsByAccountId.get(account.id) || []
      const occupiedSlots = linkedSlots.filter((slot) => String(slot.status || '').toLowerCase() === 'occupied' || slot.client_id)
      const panel = account.panel_id ? panelsById.get(account.panel_id) : undefined
      const app = account.app_id ? appsById.get(account.app_id) : undefined
      const client = account.client_id ? clientsById.get(account.client_id) : undefined
      const linkedClient = occupiedSlots
        .map((slot) => (slot.client_id ? clientsById.get(slot.client_id) : undefined))
        .find((row): row is ClientRow => Boolean(row))

      return {
        id: account.id,
        servidor: resolveServer(panel, account),
        app: resolveApp(app, account),
        codigo: codeFromSeed(account.panel_external_id || account.id),
        usuario: maskUsername(account.username || 'usuario'),
        senha: maskPassword(account.password_secret || 'senha'),
        clientePrincipal: client?.name || linkedClient?.name || 'Cliente',
        telefonePrincipal: maskPhone(client?.phone_e164 || linkedClient?.phone_e164 || ''),
        vencimento: formatDateBR(account.expires_at || account.activated_at || new Date().toISOString()),
        vagasTotal: account.max_slots || linkedSlots.length || 1,
        clientesVinculados: occupiedSlots.map((slot, index) => {
          const linkedClient = slot.client_id ? clientsById.get(slot.client_id) : undefined
          return {
            id: linkedClient?.id || slot.client_id || `${account.id}:${slot.slot_number}`,
            nome: linkedClient?.name || `Cliente ${index + 1}`,
            telefone: maskPhone(linkedClient?.phone_e164 || ''),
            criadoEm: formatDateBR(linkedClient?.created_at || slot.assigned_at || account.activated_at || new Date().toISOString()),
          }
        }),
      }
    })

    const freeToday = mapped
      .filter((item) => item.clientesVinculados.length < item.vagasTotal)
      .filter((item) => {
        const account = (accountsRes.data as AccountRow[] || []).find((row) => row.id === item.id)
        return String(account?.created_at || account?.activated_at || '') >= todayStart
      })
      .sort((a, b) => {
        const accountA = (accountsRes.data as AccountRow[] || []).find((row) => row.id === a.id)
        const accountB = (accountsRes.data as AccountRow[] || []).find((row) => row.id === b.id)
        return String(accountB?.created_at || accountB?.activated_at || '').localeCompare(String(accountA?.created_at || accountA?.activated_at || ''))
      })[0]

    const fullGroups = mapped.filter((item) => item.vagasTotal >= 2 && item.clientesVinculados.length >= 2)
    const items = freeToday && !fullGroups.some((item) => item.id === freeToday.id)
      ? [freeToday, ...fullGroups]
      : fullGroups

    return { data_source: 'supabase', items }
  } catch {
    return { data_source: 'mock', items: buildMockItems() }
  }
}
