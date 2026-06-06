import { maskDeviceKey, maskPassword, maskPhone, maskSensitiveText, maskUsername } from '@/lib/services/masking'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type JsonRecord = Record<string, unknown>

export type ClientAssistantMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  created_at: string
  metadata?: JsonRecord
}

type ClientRow = {
  id: string
  name: string | null
  phone_e164: string | null
  status: string | null
  legacy_metadata: JsonRecord | null
}

function db() {
  const client = getSupabaseServerClient()
  if (!client) throw new Error('Supabase server env ausente.')
  return client
}

function safeMetadata(metadata: JsonRecord | null | undefined): JsonRecord {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
}

function assistantMemory(metadata: JsonRecord): JsonRecord {
  return safeMetadata(metadata.codex_memory as JsonRecord | null)
}

function chatMessages(memory: JsonRecord): ClientAssistantMessage[] {
  return Array.isArray(memory.chat_messages) ? memory.chat_messages.slice(-60) as ClientAssistantMessage[] : []
}

function maskContextValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') return value
  if (/phone|telefone/i.test(key)) return maskPhone(value)
  if (/username|usuario|login/i.test(key)) return maskUsername(value)
  if (/password|senha/i.test(key)) return maskPassword(value)
  if (/device/i.test(key)) return maskDeviceKey(value)
  return maskSensitiveText(value)
}

function cleanText(value: unknown, limit = 1800): string {
  return maskSensitiveText(String(value || '').trim()).slice(0, limit)
}

export async function getClientAssistantContext(clientId: string) {
  const database = db()
  const [clientRes, accountRes, renewalRes, problemRes, testRes] = await Promise.all([
    database.from('clients').select('id,name,phone_e164,status,legacy_metadata').eq('id', clientId).maybeSingle(),
    database.from('accounts').select('id,username,provider,provider_code,panel_external_id,expires_at,legacy_metadata,app_id,panel_id,created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1),
    database.from('renewals').select('plan_key,amount_cents,due_at,status,created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1),
    database.from('problems').select('id,type,status,title,description,opened_at,created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5),
    database.from('tests').select('id,status,device_key,expires_at,legacy_metadata,created_at,app_id,panel_id').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5),
  ])

  if (clientRes.error) throw new Error(clientRes.error.message)
  if (!clientRes.data) throw new Error('Cliente nao encontrado.')
  for (const result of [accountRes, renewalRes, problemRes, testRes]) {
    if (result.error) throw new Error(result.error.message)
  }

  const client = clientRes.data as ClientRow
  const account = (accountRes.data || [])[0] as JsonRecord | undefined
  const renewal = (renewalRes.data || [])[0] as JsonRecord | undefined
  const latestTest = (testRes.data || [])[0] as JsonRecord | undefined
  const metadata = safeMetadata(client.legacy_metadata)
  const memory = assistantMemory(metadata)

  const accountMetadata = safeMetadata(account?.legacy_metadata as JsonRecord | null)
  const testMetadata = safeMetadata(latestTest?.legacy_metadata as JsonRecord | null)
  const context = {
    client_id: client.id,
    name: client.name || 'Cliente',
    phone: maskPhone(client.phone_e164 || ''),
    status: client.status || '',
    app: maskContextValue('app', metadata.app_key || memory.app_usado || accountMetadata.app_key || testMetadata.app_key || ''),
    panel: maskContextValue('panel', metadata.panel_key || memory.painel_usado || account?.provider || testMetadata.panel_key || ''),
    plan: renewal?.plan_key || memory.plano || '',
    due_at: renewal?.due_at || account?.expires_at || '',
    username: maskContextValue('username', account?.username || testMetadata.username || ''),
    provider_code: maskContextValue('provider_code', account?.provider_code || testMetadata.provider_code || ''),
    device_key: maskContextValue('device_key', latestTest?.device_key || testMetadata.device_key || ''),
    latest_test: latestTest ? {
      id: latestTest.id,
      status: latestTest.status,
      expires_at: latestTest.expires_at,
      xcloud_worker: safeMetadata(testMetadata.xcloud_worker as JsonRecord | null),
    } : null,
    open_problems: (problemRes.data || []).map((problem) => ({
      id: problem.id,
      type: problem.type,
      status: problem.status,
      title: maskSensitiveText(problem.title || ''),
      description: maskSensitiveText(problem.description || ''),
      created_at: problem.created_at || problem.opened_at,
    })),
  }

  return {
    client,
    metadata,
    memory: {
      resumo_cliente: memory.resumo_cliente || '',
      problemas_recorrentes: Array.isArray(memory.problemas_recorrentes) ? memory.problemas_recorrentes : [],
      app_usado: memory.app_usado || context.app || '',
      painel_usado: memory.painel_usado || context.panel || '',
      historico_acoes: Array.isArray(memory.historico_acoes) ? memory.historico_acoes : [],
      mensagens_importantes: Array.isArray(memory.mensagens_importantes) ? memory.mensagens_importantes : [],
      bugs_conhecidos: Array.isArray(memory.bugs_conhecidos) ? memory.bugs_conhecidos : [],
      solucoes_funcionaram: Array.isArray(memory.solucoes_funcionaram) ? memory.solucoes_funcionaram : [],
      prompts_codex: Array.isArray(memory.prompts_codex) ? memory.prompts_codex : [],
      chat_messages: chatMessages(memory),
      updated_at: memory.updated_at || null,
    },
    context,
    execution: {
      available: false,
      reason: 'Execucao automatica desativada por seguranca. Use Gerar prompt para Codex.',
    },
  }
}

async function saveMemory(client: ClientRow, metadata: JsonRecord, nextMemory: JsonRecord) {
  const database = db()
  const { error } = await database
    .from('clients')
    .update({
      legacy_metadata: {
        ...metadata,
        codex_memory: {
          ...nextMemory,
          updated_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', client.id)
  if (error) throw new Error(error.message)
}

export async function appendClientAssistantMessages(clientId: string, messages: ClientAssistantMessage[]) {
  const state = await getClientAssistantContext(clientId)
  const memory = assistantMemory(state.metadata)
  const nextMessages = [...chatMessages(memory), ...messages].slice(-60)
  const nextMemory = {
    ...memory,
    app_usado: state.context.app || memory.app_usado || '',
    painel_usado: state.context.panel || memory.painel_usado || '',
    chat_messages: nextMessages,
  }
  await saveMemory(state.client, state.metadata, nextMemory)
  return { ...state, memory: { ...state.memory, chat_messages: nextMessages } }
}

function diagnosticResponse(message: string, context: JsonRecord): string {
  const text = message.toLowerCase()
  const parts = [
    `Diagnostico para ${context.name || 'cliente'}:`,
    '',
  ]
  if (text.includes('xcloud')) {
    parts.push('1. Conferir se a device_key esta correta e se o XCloud mostra a device como Active.')
    parts.push('2. Se a device existir com playlist antiga, expirar o teste antigo e recriar a device antes de reenviar acesso.')
    parts.push('3. Se aparecer DEVICE_NOT_FOUND_AFTER_ADD, nao enviar mensagem ao cliente; gerar nova tentativa somente depois de confirmar que a anterior falhou/foi cancelada.')
  } else if (text.includes('lg')) {
    parts.push('1. Confirmar se a TV e LG webOS e orientar loja de apps procurando XCloud TV ou IPTV XCloud Pro.')
    parts.push('2. Evitar instrucoes de Downloader em LG.')
  } else if (text.includes('login') || text.includes('senha')) {
    parts.push('1. Conferir usuario/senha do painel do provedor.')
    parts.push('2. Copiar credencial direto do cadastro real antes de reenviar mensagem.')
  } else {
    parts.push('1. Identificar app, painel, status do teste/assinatura e ultima acao feita.')
    parts.push('2. Registrar o sintoma em Problemas se houver risco de recorrencia.')
    parts.push('3. Gerar prompt para Codex com contexto mascarado se precisar alterar codigo.')
  }
  parts.push('')
  parts.push('Proximo passo recomendado: registre a acao executada na memoria do cliente para reaproveitar o historico.')
  return parts.join('\n')
}

export async function runClientAssistantChat(clientId: string, content: string) {
  const state = await getClientAssistantContext(clientId)
  const now = new Date().toISOString()
  const userMessage: ClientAssistantMessage = { role: 'user', content: cleanText(content), created_at: now }
  const assistantMessage: ClientAssistantMessage = {
    role: 'assistant',
    content: diagnosticResponse(content, state.context),
    created_at: new Date().toISOString(),
    metadata: { mode: 'local_prompt_builder' },
  }
  const saved = await appendClientAssistantMessages(clientId, [userMessage, assistantMessage])
  return { ok: true, response: assistantMessage, messages: saved.memory.chat_messages, context: state.context, execution: state.execution }
}

export async function updateClientAssistantMemory(clientId: string, input: JsonRecord) {
  const state = await getClientAssistantContext(clientId)
  const memory = assistantMemory(state.metadata)
  const note = cleanText(input.note || input.content || '')
  const action = note ? { at: new Date().toISOString(), note } : null
  const nextMemory = {
    ...memory,
    resumo_cliente: cleanText(input.resumo_cliente || input.summary || memory.resumo_cliente || '', 1200),
    app_usado: cleanText(input.app_usado || memory.app_usado || state.context.app || '', 120),
    painel_usado: cleanText(input.painel_usado || memory.painel_usado || state.context.panel || '', 120),
    historico_acoes: action ? [...(Array.isArray(memory.historico_acoes) ? memory.historico_acoes : []), action].slice(-80) : (Array.isArray(memory.historico_acoes) ? memory.historico_acoes : []),
    problemas_recorrentes: Array.isArray(input.problemas_recorrentes) ? input.problemas_recorrentes.map((v) => cleanText(v, 240)).slice(-30) : (Array.isArray(memory.problemas_recorrentes) ? memory.problemas_recorrentes : []),
    bugs_conhecidos: Array.isArray(input.bugs_conhecidos) ? input.bugs_conhecidos.map((v) => cleanText(v, 240)).slice(-30) : (Array.isArray(memory.bugs_conhecidos) ? memory.bugs_conhecidos : []),
    solucoes_funcionaram: Array.isArray(input.solucoes_funcionaram) ? input.solucoes_funcionaram.map((v) => cleanText(v, 240)).slice(-30) : (Array.isArray(memory.solucoes_funcionaram) ? memory.solucoes_funcionaram : []),
    chat_messages: chatMessages(memory),
  }
  await saveMemory(state.client, state.metadata, nextMemory)
  return { ok: true, memory: nextMemory, context: state.context }
}

export async function createClientAssistantTask(clientId: string, input: JsonRecord) {
  const state = await getClientAssistantContext(clientId)
  const kind = String(input.type || 'prompt')
  const description = cleanText(input.description || input.content || input.prompt || '', 1600)
  if (kind === 'problem') {
    const database = db()
    const { data, error } = await database.from('problems').insert({
      client_id: clientId,
      account_id: null,
      type: 'outro',
      status: 'open',
      title: description.slice(0, 120) || `Ocorrencia ${state.context.name}`,
      description: description || 'Ocorrencia criada pelo Assistente do cliente.',
      opened_at: new Date().toISOString(),
    }).select('id').single()
    if (error) throw new Error(error.message)
    await updateClientAssistantMemory(clientId, { note: `Ocorrencia criada em Problemas: ${description}` })
    return { ok: true, type: 'problem', problem_id: (data as { id: string }).id }
  }

  const prompt = [
    'Contexto seguro do cliente Central Play Plus:',
    JSON.stringify(state.context, null, 2),
    '',
    'Memoria operacional:',
    JSON.stringify({ ...state.memory, chat_messages: undefined }, null, 2),
    '',
    'Tarefa solicitada:',
    description || 'Gerar diagnostico e plano de correcao sem expor tokens, senhas completas ou dados sensiveis.',
    '',
    'Regras: nao executar comandos destrutivos; pedir confirmacao antes de alterar producao; preservar WhatsApp real, geracao de teste, XCloud worker e Supabase.',
  ].join('\n')

  const memory = assistantMemory(state.metadata)
  const nextMemory = {
    ...memory,
    prompts_codex: [...(Array.isArray(memory.prompts_codex) ? memory.prompts_codex : []), { at: new Date().toISOString(), prompt: prompt.slice(0, 6000) }].slice(-30),
  }
  await saveMemory(state.client, state.metadata, nextMemory)
  return { ok: true, type: 'prompt', prompt }
}
