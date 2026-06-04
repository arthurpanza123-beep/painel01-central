/**
 * app/api/tests/create-mock/route.ts
 *
 * POST /api/tests/create-mock
 *
 * Gera um teste simulado e persiste no Supabase staging.
 * Se o Supabase não estiver configurado, retorna os dados
 * gerados com source: "mock" sem gravar nada.
 *
 * REGRAS:
 * - NÃO chama Ninety, Yellow, Brasil, XCloud, Evolution ou WhatsApp.
 * - NÃO gera teste real em painel externo.
 * - NÃO envia mensagem.
 * - Credenciais geradas são fake/simuladas.
 * - Senhas, usuários, M3U e device key são mascarados na resposta.
 *
 * Payload esperado (JSON):
 *   { nome: string, telefone: string, app: string, servidor: string }
 *
 * Resposta de sucesso (200):
 *   { success: true, source: "supabase"|"mock", client, test, account }
 *
 * Resposta de erro (400 | 500):
 *   { success: false, error: string }
 *
 * Tabelas gravadas (quando Supabase disponível):
 *   clients, tests, accounts, account_slots, pipeline_events, logs
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server'
import { maskPassword, maskUsername } from '@/lib/services/masking'

// ─── Helpers de geração fake ─────────────────────────────────────────────────

function rand(n = 6): string {
  return Math.random().toString(36).substring(2, 2 + n).toUpperCase()
}

function gerarCredenciais(nome: string) {
  const primeiroNome = nome.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')
  const usuario      = `usr_${primeiroNome}${Math.floor(Math.random() * 999)}`
  const senha        = `${rand(5)}${rand(5)}`.substring(0, 10)
  const codigo       = `#${String(Math.floor(Math.random() * 9000) + 1000)}`
  const m3uBase      = 'http://srv.centralplay.tv'
  const m3u          = `${m3uBase}/get.php?username=${usuario}&password=${senha}&type=m3u_plus`
  const validadeDate = new Date()
  validadeDate.setHours(validadeDate.getHours() + 2)
  const validade = validadeDate.toISOString()
  const validadeBR = validadeDate.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const agora = new Date().toISOString()
  const hoje  = new Date().toLocaleDateString('pt-BR')
  const hora  = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return { usuario, senha, codigo, m3u, validade, validadeBR, agora, hoje, hora }
}

// ─── Handler principal ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Parse e validação do payload
  let body: { nome?: string; telefone?: string; app?: string; servidor?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Payload inválido.' }, { status: 400 })
  }

  const { nome, telefone, app, servidor } = body
  if (!nome?.trim() || !telefone?.trim() || !app?.trim() || !servidor?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Campos obrigatórios: nome, telefone, app, servidor.' },
      { status: 400 },
    )
  }

  // 2. Gerar credenciais fake (não chama nenhuma API externa)
  const cred = gerarCredenciais(nome)

  // 3. Montar shapes das entidades
  const clientId  = crypto.randomUUID()
  const testId    = crypto.randomUUID()
  const accountId = crypto.randomUUID()
  const slotId    = crypto.randomUUID()

  const clientRow = {
    id:         clientId,
    name:       nome.trim(),
    phone:      telefone.trim(),
    app,
    server:     servidor,
    plan:       'Teste 2h',
    price:      0,
    due_date:   cred.validade.split('T')[0],
    username:   cred.usuario,
    password:   cred.senha,           // armazenado em claro no staging; produção deve criptografar
    status:     'ativo',
    created_at: cred.agora,
  }

  const testRow = {
    id:           testId,
    client_name:  nome.trim(),
    phone:        telefone.trim(),
    app,
    server:       servidor,
    username:     cred.usuario,
    password:     cred.senha,
    code:         cred.codigo,
    m3u_url:      cred.m3u,
    status:       'ativo',
    valid_until:  cred.validade,
    created_at:   cred.agora,
    created_date: cred.hoje,
    created_time: cred.hora,
  }

  const accountRow = {
    id:            accountId,
    server:        servidor,
    app,
    code:          cred.codigo,
    username:      cred.usuario,
    password:      cred.senha,
    main_client:   nome.trim(),
    main_phone:    telefone.trim(),
    due_date:      cred.validade.split('T')[0],
    total_slots:   4,
  }

  const slotRow = {
    id:         slotId,
    account_id: accountId,
    client_id:  clientId,
    label:      'Tela 01',
    occupied:   true,
    username:   cred.usuario,
    created_at: cred.agora,
  }

  const pipelineRow = {
    id:         crypto.randomUUID(),
    client_id:  clientId,
    test_id:    testId,
    name:       nome.trim(),
    phone:      telefone.trim(),
    app,
    server:     servidor,
    stage:      'teste_gerado',
    created_at: cred.agora,
    updated_at: cred.agora,
  }

  const logRow = {
    id:        crypto.randomUUID(),
    level:     'success',
    message:   `Teste mock gerado para ${nome.trim()} | ${app} / ${servidor}`,
    details:   `code=${cred.codigo} | valid_until=${cred.validade}`,
    timestamp: cred.agora,
    source:    'wizard',
  }

  // 4. Tentar gravar no Supabase; fallback silencioso se não configurado
  const supabase = getSupabaseServerClient()
  let source: 'supabase' | 'mock' = 'mock'

  if (supabase && isSupabaseServerConfigured) {
    try {
      // Inserções em paralelo — falha silenciosa individual para não quebrar o fluxo
      const [c, t, a, s, p, l] = await Promise.allSettled([
        supabase.from('clients').insert(clientRow),
        supabase.from('tests').insert(testRow),
        supabase.from('accounts').insert(accountRow),
        supabase.from('account_slots').insert(slotRow),
        supabase.from('pipeline_events').insert(pipelineRow),
        supabase.from('logs').insert(logRow),
      ])

      // Log de diagnóstico — apenas no servidor, nunca exposto ao cliente
      const failures = [c, t, a, s, p, l]
        .map((r, i) => (r.status === 'rejected' ? `table[${i}]: ${r.reason}` : null))
        .filter(Boolean)

      if (failures.length === 0) {
        source = 'supabase'
      } else {
        // Pelo menos uma tabela gravou ou nenhuma — ainda retorna sucesso com source=mock
        console.error('[api/tests/create-mock] Falhas parciais no Supabase:', failures)
      }
    } catch (err) {
      console.error('[api/tests/create-mock] Erro ao gravar no Supabase:', err)
      // Fallback: continua com source = 'mock'
    }
  }

  // 5. Montar resposta — NUNCA expor senha ou M3U em claro
  return NextResponse.json({
    success: true,
    source,
    client: {
      id:     clientId,
      name:   clientRow.name,
      phone:  clientRow.phone,
      app:    clientRow.app,
      server: clientRow.server,
      status: clientRow.status,
    },
    test: {
      id:           testId,
      code:         testRow.code,
      username:     maskUsername(testRow.username),
      password:     maskPassword(testRow.password),
      // m3u_url: omitido intencionalmente — não expor no response
      valid_until:  testRow.valid_until,
      created_date: testRow.created_date,
      created_time: testRow.created_time,
      status:       testRow.status,
      // validade formatada para exibição no wizard
      validadeBR:   cred.validadeBR,
      // mensagem pronta para copiar/WhatsApp — credenciais em claro apenas aqui
      mensagem: [
        `Olá ${nome.trim()}! Segue seu teste de 2 horas:`,
        ``,
        `Aplicativo: ${app}`,
        `Servidor: ${servidor}`,
        `Usuário: ${testRow.username}`,
        `Senha: ${testRow.password}`,
        `Código: ${testRow.code}`,
        `Validade: ${cred.validadeBR}`,
        ``,
        `Qualquer dúvida é só chamar!`,
      ].join('\n'),
    },
    account: {
      id:     accountId,
      code:   accountRow.code,
      server: accountRow.server,
      app:    accountRow.app,
    },
  })
}
