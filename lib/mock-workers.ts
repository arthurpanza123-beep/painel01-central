/**
 * lib/mock-workers.ts
 *
 * Mocks de todos os workers/funções usadas no fluxo de gerar teste.
 * NÃO chama API real. NÃO envia mensagem. NÃO cria conta ou slot.
 * Todos os delays são simulados para representar o processamento.
 */

export type WorkerStatus =
  | 'aguardando'
  | 'processando'
  | 'concluido'
  | 'falhou'

export type XcloudStepId = 'acesso' | 'dispositivo' | 'xtream' | 'confirmacao'

export interface XcloudActivationJob {
  clientName: string
  phone: string
  deviceKey: string
  provider: string
  host: string
  username: string
  password: string
  pedido: string
  validade: string
}

export interface XcloudStepResult {
  step: XcloudStepId
  status: WorkerStatus
  detail?: string
}

// ─── Delay helper ────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function rand(n = 6) {
  return Math.random().toString(36).substring(2, 2 + n).toUpperCase()
}

// ─── createTestMock ──────────────────────────────────────────────────────────

export async function createTestMock(params: {
  clientName: string
  phone: string
  app: string
  provider: string
  deviceKey?: string
}) {
  await delay(400)
  const nome      = params.clientName.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')
  const usuario   = `usr_${nome}${Math.floor(Math.random() * 999)}`
  const senha     = `${rand(5)}${rand(5)}`.substring(0, 10)
  const codigo    = `#${String(Math.floor(Math.random() * 9000) + 1000)}`
  const pedido    = `#${String(Math.floor(Math.random() * 9000) + 1000)}`
  const validade  = new Date(); validade.setHours(validade.getHours() + 2)
  const validadeBR = validade.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  return {
    success: true,
    source: 'mock' as const,
    pedido,
    usuario,
    senha,
    codigo,
    validadeBR,
    host: 'http://srv.centralplay.tv',
    deviceKey: params.deviceKey || `DEV-${rand(8)}`,
  }
}

// ─── createXcloudActivationJobMock ───────────────────────────────────────────

export async function createXcloudActivationJobMock(job: XcloudActivationJob): Promise<{
  jobId: string
  status: 'criado'
}> {
  await delay(200)
  return {
    jobId: `JOB-${rand(8)}`,
    status: 'criado',
  }
}

// ─── generateAccessMock ──────────────────────────────────────────────────────
// Worker 1: Gera acesso no painel IPTV (Yellow/Ninety/CineMax)

export async function generateAccessMock(params: {
  provider: string
  clientName: string
  deviceKey: string
}): Promise<XcloudStepResult & { host?: string; username?: string; password?: string }> {
  await delay(900)
  const nome    = params.clientName.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')
  const falhar  = Math.random() < 0.03 // 3% chance de falha mock
  if (falhar) {
    return { step: 'acesso', status: 'falhou', detail: 'Timeout ao conectar no painel.' }
  }
  return {
    step:     'acesso',
    status:   'concluido',
    detail:   'Credenciais Xtream geradas com sucesso.',
    host:     'http://srv.centralplay.tv',
    username: `usr_${nome}${Math.floor(Math.random() * 999)}`,
    password: `${rand(5)}${rand(5)}`.substring(0, 10),
  }
}

// ─── addXcloudDeviceMock ─────────────────────────────────────────────────────
// Worker 2: Adiciona device no painel XCloud

export async function addXcloudDeviceMock(params: {
  deviceKey: string
}): Promise<XcloudStepResult> {
  await delay(1100)
  const r = Math.random()
  if (r < 0.03) {
    return { step: 'dispositivo', status: 'falhou', detail: 'Falha ao conectar no painel XCloud.' }
  }
  if (r < 0.15) {
    return { step: 'dispositivo', status: 'concluido', detail: 'Device já existia. Reaproveitado.' }
  }
  return { step: 'dispositivo', status: 'concluido', detail: 'Device adicionado com ativação imediata.' }
}

// ─── attachXtreamMock ────────────────────────────────────────────────────────
// Worker 3: Vincula credenciais Xtream no device XCloud

export async function attachXtreamMock(params: {
  deviceKey: string
  host: string
  username: string
  password: string
}): Promise<XcloudStepResult> {
  await delay(800)
  const falhar = Math.random() < 0.03
  if (falhar) {
    return { step: 'xtream', status: 'falhou', detail: 'Falha ao salvar credenciais Xtream.' }
  }
  return { step: 'xtream', status: 'concluido', detail: 'Xtream vinculado. Tela "Please reload your APP" confirmada.' }
}

// ─── retryXcloudStepMock ─────────────────────────────────────────────────────
// Retry por etapa — não reinicia o job inteiro

export async function retryXcloudStepMock(
  step: XcloudStepId,
  params: Record<string, string>
): Promise<XcloudStepResult> {
  if (step === 'acesso')      return generateAccessMock({ provider: params.provider ?? 'yellow', clientName: params.clientName ?? 'Cliente', deviceKey: params.deviceKey ?? '' })
  if (step === 'dispositivo') return addXcloudDeviceMock({ deviceKey: params.deviceKey ?? '' })
  if (step === 'xtream')      return attachXtreamMock({ deviceKey: params.deviceKey ?? '', host: params.host ?? '', username: params.username ?? '', password: params.password ?? '' })
  return { step, status: 'falhou', detail: 'Etapa desconhecida.' }
}

// ─── activateClientMock ──────────────────────────────────────────────────────
// Fluxo de ATIVAÇÃO (ocupa tela) — separado do teste

export async function activateClientMock(params: {
  clientName: string
  phone: string
  app: string
  provider: string
  testeId: string
}): Promise<{
  success: boolean
  accountId?: string
  slotUsed?: number
  detail: string
  usouVagaExistente: boolean
}> {
  await delay(600)
  const usouVaga = Math.random() < 0.4 // 40% chance de ter vaga livre
  return {
    success: true,
    accountId: `ACC-${rand(6)}`,
    slotUsed:  usouVaga ? 1 : 2,
    detail:    usouVaga
      ? 'Vaga livre encontrada na conta existente. Tela ocupada com economia de crédito.'
      : 'Nova conta criada. Tela 1 ocupada.',
    usouVagaExistente: usouVaga,
  }
}
