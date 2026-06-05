import { MOCK_PROBLEMAS, type Problema, type StatusProblema, type TipoProblema } from '@/lib/mock-data'
import { formatDateTimeBR } from '@/lib/services/date-normalizer'
import { maskPhone, maskSensitiveText } from '@/lib/services/masking'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'

export type ProblemsQueryResult = {
  data_source: 'mock' | 'supabase'
  items: Problema[]
}

type ProblemRow = { id: string; client_id: string; account_id: string | null; type: string; status: string | null; title: string | null; description: string | null; opened_at: string | null; created_at: string | null }
type ClientRow = { id: string; name: string | null; phone_e164: string | null }
type AccountRow = { id: string; app_id: string | null; panel_id: string | null; provider: string | null }
type AppRow = { id: string; name: string; key: string }
type PanelRow = { id: string; name: string; key: string }

const KNOWN_TYPES = new Set<TipoProblema>(['app_nao_abre', 'login_invalido', 'travando', 'sem_imagem', 'sem_audio', 'lista_nao_carrega', 'senha_incorreta', 'renovacao_nao_entrou', 'outro'])

function mapStatus(value: string | null): StatusProblema {
  if (value === 'resolved' || value === 'closed') return 'resolvido'
  if (value === 'investigating' || value === 'waiting_customer') return 'em_analise'
  return 'aberto'
}

function buildMockItems(): Problema[] {
  return MOCK_PROBLEMAS.map((problem) => ({
    ...problem,
    telefone: maskPhone(problem.telefone),
    descricao: maskSensitiveText(problem.descricao),
  }))
}

export async function getProblemsData(): Promise<ProblemsQueryResult> {
  if (!isSupabaseServerConfigured) return { data_source: 'mock', items: buildMockItems() }
  const db = getSupabaseServerClient()
  if (!db) return { data_source: 'mock', items: buildMockItems() }

  try {
    const [problemsRes, clientsRes, accountsRes, appsRes, panelsRes] = await Promise.all([
      db.from('problems').select('id,client_id,account_id,type,status,title,description,opened_at,created_at').order('opened_at', { ascending: false }).limit(100),
      db.from('clients').select('id,name,phone_e164'),
      db.from('accounts').select('id,app_id,panel_id,provider'),
      db.from('apps').select('id,name,key'),
      db.from('panels').select('id,name,key'),
    ])

    if (problemsRes.error) throw new Error(problemsRes.error.message)
    if (clientsRes.error) throw new Error(clientsRes.error.message)
    if (accountsRes.error) throw new Error(accountsRes.error.message)
    if (appsRes.error) throw new Error(appsRes.error.message)
    if (panelsRes.error) throw new Error(panelsRes.error.message)

    const clientsById = new Map((clientsRes.data as ClientRow[] || []).map((row) => [row.id, row]))
    const accountsById = new Map((accountsRes.data as AccountRow[] || []).map((row) => [row.id, row]))
    const appsById = new Map((appsRes.data as AppRow[] || []).map((row) => [row.id, row]))
    const panelsById = new Map((panelsRes.data as PanelRow[] || []).map((row) => [row.id, row]))

    const items: Problema[] = (problemsRes.data as ProblemRow[] || []).map((problem) => {
      const client = clientsById.get(problem.client_id)
      const account = problem.account_id ? accountsById.get(problem.account_id) : undefined
      const app = account?.app_id ? appsById.get(account.app_id) : undefined
      const panel = account?.panel_id ? panelsById.get(account.panel_id) : undefined
      const type = KNOWN_TYPES.has(problem.type as TipoProblema) ? problem.type as TipoProblema : 'outro'

      return {
        id: problem.id,
        cliente: client?.name || 'Cliente',
        telefone: maskPhone(client?.phone_e164 || ''),
        app: app?.name || account?.provider || 'Aplicativo',
        servidor: panel?.name || account?.provider || 'Servidor',
        tipo: type,
        descricao: maskSensitiveText(problem.description || problem.title || 'Sem descricao'),
        status: mapStatus(problem.status),
        criadoEm: formatDateTimeBR(problem.opened_at || problem.created_at || new Date().toISOString()).replace(' às ', ' '),
      }
    })

    return { data_source: 'supabase', items }
  } catch {
    return { data_source: 'mock', items: buildMockItems() }
  }
}
