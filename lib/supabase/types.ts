/**
 * lib/supabase/types.ts
 *
 * Tipos compatíveis com o schema futuro do Supabase.
 * Estes tipos são independentes dos mocks e devem refletir
 * exatamente as colunas das tabelas do banco quando forem criadas.
 *
 * ESTADO ATUAL: Apenas tipagem — nenhuma tabela existe ainda.
 * MIGRAÇÃO FUTURA: Substituir lib/mock-data.ts por queries reais
 *   que retornem esses mesmos shapes.
 */

// ─── Enums / Unions ─────────────────────────────────────────────────────────

export type ClientStatus = 'ativo' | 'expirado' | 'pendente' | 'suspenso'
export type TestStatus   = 'ativo' | 'expirado' | 'pago' | 'sem_resposta'
export type RenewalStatus = 'pendente' | 'pago' | 'atrasado' | 'suspenso'
export type ProblemStatus = 'aberto' | 'em_analise' | 'resolvido'
export type LogLevel      = 'info' | 'warning' | 'error' | 'success'
export type PipelineStage =
  | 'novo_lead'
  | 'contato'
  | 'teste_gerado'
  | 'testando'
  | 'interessado'
  | 'pagou'
  | 'ativado'
  | 'renovacao'

// ─── Entidades principais ────────────────────────────────────────────────────

/**
 * Tabela: clients
 * Representa um cliente ativo com assinatura em curso.
 */
export interface Client {
  id: string
  name: string
  phone: string
  app: string
  server: string
  plan: string
  price: number
  due_date: string           // ISO date — ex: "2025-07-10"
  username: string
  password: string           // TODO: nunca expor no client-side; buscar apenas via server action
  status: ClientStatus
  created_at: string         // ISO datetime
  updated_at?: string
}

/**
 * Tabela: tests
 * Representa um período de teste gratuito gerado para um lead.
 */
export interface Test {
  id: string
  client_name: string
  phone: string
  app: string
  server: string
  username: string
  password: string           // TODO: nunca expor no client-side
  code: string
  m3u_url?: string
  status: TestStatus
  valid_until: string        // ISO datetime
  created_at: string
  created_date: string       // dd/MM/yyyy — para exibição
  created_time: string       // HH:mm — para exibição
}

/**
 * Tabela: accounts
 * Representa uma conta/slot de painel que agrupa clientes.
 */
export interface Account {
  id: string
  server: string
  app: string
  code: string               // ex: #4821
  username: string
  password: string           // TODO: nunca expor no client-side
  main_client: string
  main_phone: string
  due_date: string
  total_slots: number
  linked_clients: LinkedClient[]
}

export interface LinkedClient {
  id: string
  name: string
  phone: string
  created_at: string
}

/**
 * Tabela: renewals
 * Representa uma renovação pendente ou concluída.
 */
export interface Renewal {
  id: string
  client_id: string
  client_name: string
  phone: string
  plan: string
  price: number
  due_date: string           // ISO date
  status: RenewalStatus
  days_remaining: number
}

/**
 * Tabela: payments / financial records
 * Representa uma entrada financeira (recebimento de plano).
 */
export interface Payment {
  id: string
  client_id: string
  client_name: string
  amount: number
  plan: string
  paid_at: string            // ISO datetime
  method?: string            // 'pix' | 'dinheiro' | 'cartao'
  notes?: string
}

/**
 * Tabela: problems
 * Representa um chamado/problema reportado por um cliente.
 */
export interface Problem {
  id: string
  client_name: string
  phone: string
  app: string
  server: string
  type: string               // ex: 'app_nao_abre', 'login_invalido' etc
  description: string
  status: ProblemStatus
  created_at: string
  resolved_at?: string
}

/**
 * Tabela: integrations (painéis externos)
 * Representa a configuração de um painel de ativação externo.
 *
 * IMPORTANTE: token e senha NUNCA devem ser retornados ao client.
 * Usar apenas em server actions / route handlers com service role.
 */
export interface Integration {
  id: string
  name: string
  base_url: string
  username: string
  // token e password: armazenados no banco, nunca retornados ao frontend
  status: 'conectado' | 'desconectado' | 'erro'
  credits: number
  cost_per_activation: number
  remaining_activations: number
  low_balance_alert: boolean
}

/**
 * Tabela: logs
 * Representa um log de operação do sistema (terminal de debug).
 */
export interface Log {
  id: string
  level: LogLevel
  message: string
  details?: string
  timestamp: string          // ISO datetime
  source?: string            // 'wizard' | 'evolution' | 'painel' | 'sistema'
}

/**
 * Tabela: pipeline_leads
 * Representa um lead no funil de vendas.
 */
export interface PipelineLead {
  id: string
  name: string
  phone: string
  app?: string
  server?: string
  stage: PipelineStage
  value?: number
  notes?: string
  created_at: string
  updated_at: string
  test_id?: string
  client_id?: string
}

// ─── Métricas agregadas (não são tabelas — resultado de queries) ─────────────

/**
 * Shape retornado por getDashboardData().
 * Pode vir de mocks OU de queries reais ao Supabase.
 *
 * MIGRAÇÃO FUTURA: substituir pela query em lib/queries/dashboard.ts
 */
export interface DashboardMetrics {
  /** KPIs principais */
  active_tests: number
  total_tests: number
  active_clients: number
  leads_in_progress: number
  /** Ambientes ativados hoje (clientes ativados na data atual) */
  activated_today?: number

  /** Financeiro */
  available_credits: number
  revenue_current_month: number
  monthly_renewal_forecast?: number
  revenue_due_30d?: number
  revenue_forecast_30d: number
  revenue_forecast_60d: number
  revenue_forecast_90d: number

  /** Funil */
  funnel: {
    stage: PipelineStage
    label: string
    count: number
    color: string
  }[]

  /** Créditos por painel */
  panel_credits: {
    id: string
    panel: string
    balance: number
    low_balance: boolean
  }[]

  /** Origem dos dados — usado para indicadores visuais no painel */
  data_source: 'mock' | 'supabase'
}
