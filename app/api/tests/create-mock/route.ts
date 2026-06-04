/**
 * app/api/tests/create-mock/route.ts
 *
 * POST /api/tests/create-mock
 *
 * Gera um teste simulado e persiste no Supabase staging.
 * Se o Supabase não estiver configurado (ou qualquer insert falhar),
 * retorna source:"mock" — NUNCA retorna source:"supabase" sem gravar de verdade.
 *
 * REGRAS:
 * - NÃO chama Ninety, Yellow, Brasil, XCloud, Evolution ou WhatsApp.
 * - NÃO gera teste real em painel externo.
 * - NÃO envia mensagem.
 * - Credenciais são fake/simuladas.
 * - Senhas, usuários, M3U e device_key são mascarados na resposta.
 *
 * Payload esperado (JSON):
 *   {
 *     nome: string, telefone: string, app: string, servidor: string,
 *     deviceKey?: string,
 *     manualFields?: { user: string, pass: string, code: string, host: string, text: string },
 *     connection_type?: 'xtream' | 'standard'
 *   }
 *
 * Resposta de sucesso (200):
 *   { success: true, source: "supabase"|"mock", client, test, account }
 *
 * Resposta de erro (400):
 *   { success: false, error: string }
 *
 * Ordem de inserção quando Supabase disponível:
 *   1. clients
 *   2. accounts (sem source_test_id ainda)
 *   3. tests (com account_id)
 *   4. UPDATE accounts SET source_test_id
 *   5. account_slots
 *   6. pipeline_events
 *   7. logs
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { maskPassword, maskUsername } from '@/lib/services/masking'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rand(n = 6): string {
  return Math.random().toString(36).substring(2, 2 + n).toUpperCase()
}

function gerarCredenciais(nome: string) {
  const primeiroNome = nome.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')
  const usuario      = `usr_${primeiroNome}${Math.floor(Math.random() * 999)}`
  const senha        = `${rand(5)}${rand(5)}`.substring(0, 10)
  const codigo       = `#${String(Math.floor(Math.random() * 9000) + 1000)}`
  const deviceKey    = `DEV-${rand(8)}`
  const m3u          = `http://srv.centralplay.tv/get.php?username=${usuario}&password=${senha}&type=m3u_plus`
  const hls          = `http://srv.centralplay.tv/live/${usuario}/${senha}`
  const validadeDate = new Date()
  validadeDate.setHours(validadeDate.getHours() + 2)
  const expiresAt  = validadeDate.toISOString()
  const validadeBR = validadeDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const agora      = new Date().toISOString()
  return { usuario, senha, codigo, deviceKey, m3u, hls, expiresAt, validadeBR, agora }
}

// Mapa de keys do wizard para normalização de app/panel
const APP_KEYS: Record<string, string> = {
  xcloud:         'xcloud',
  blessed:        'blessed',
  playsim:        'playsim',
  assist_plus:    'assist_plus',
  funplay:        'funplay',
  magic_player:   'magic_player',
}

const PANEL_KEYS: Record<string, string> = {
  ninety:              'ninety',
  brasil_yellow:       'brasil_yellow',
  uniplay:             'uniplay',
  devxtop_magic:       'devxtop_magic',
  xcloud_playwright:   'xcloud_playwright',
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Parse e validação
  let body: {
    nome?: string
    telefone?: string
    app?: string
    servidor?: string
    deviceKey?: string
    manualFields?: { user?: string; pass?: string; code?: string; host?: string; text?: string }
    connection_type?: 'xtream' | 'standard'
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Payload inválido.' }, { status: 400 })
  }

  const { nome, telefone, app, servidor, deviceKey, manualFields, connection_type } = body
  if (!nome?.trim() || !telefone?.trim() || !app?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Campos obrigatórios: nome, telefone, app.' },
      { status: 400 },
    )
  }

  // Para apps que não sejam manual, servidor é obrigatório
  const isManual = app === 'manual'
  if (!isManual && !servidor?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Campo obrigatório: servidor.' },
      { status: 400 },
    )
  }

  // 2. Gerar credenciais fake — zero chamadas externas
  const cred       = gerarCredenciais(nome)
  // Se XCloud, usar deviceKey informado; senão gerar
  const finalDeviceKey = deviceKey?.trim() || cred.deviceKey
  const clientId   = crypto.randomUUID()
  const testId     = crypto.randomUUID()
  const accountId  = crypto.randomUUID()

  const appKey    = APP_KEYS[app]    ?? app
  const panelKey  = PANEL_KEYS[servidor ?? ''] ?? (servidor ?? 'manual')

  // Para modo manual, usar campos informados ou fallback gerado
  const finalUsuario = isManual ? (manualFields?.user?.trim() || cred.usuario) : cred.usuario
  const finalSenha   = isManual ? (manualFields?.pass?.trim() || cred.senha)   : cred.senha
  const finalCodigo  = isManual ? (manualFields?.code?.trim() || cred.codigo)  : cred.codigo
  const finalHost    = isManual ? (manualFields?.host?.trim() || 'http://painel.exemplo.tv') : 'http://srv.centralplay.tv'

  const isXCloud = app === 'xcloud'

  // 3. Tentar gravar no Supabase na ordem correta
  const supabase = getSupabaseServerClient()
  let source: 'supabase' | 'mock' = 'mock'

  if (supabase) {
    try {
      // ── Passo 0: buscar app_id e panel_id nas tabelas de referência ─────────
      // Se as tabelas apps/panels não existirem ainda, cai no fallback graciosamente.
      let appId:   string | null = null
      let panelId: string | null = null

      const [appsRes, panelsRes] = await Promise.allSettled([
        supabase.from('apps').select('id').eq('key', appKey).maybeSingle(),
        supabase.from('panels').select('id').eq('key', panelKey).maybeSingle(),
      ])

      if (appsRes.status === 'fulfilled' && appsRes.value.data) {
        appId = (appsRes.value.data as { id: string }).id
      }
      if (panelsRes.status === 'fulfilled' && panelsRes.value.data) {
        panelId = (panelsRes.value.data as { id: string }).id
      }

      // ── Passo 1: clients ────────────────────────────────────────────────────
      const { error: clientErr } = await supabase.from('clients').insert({
        id:     clientId,
        name:   nome.trim(),
        phone_e164: telefone.trim().replace(/\D/g, '').replace(/^(\d{2})/, '+$1'),
        phone_raw:  telefone.trim(),
        status: 'active',
        source: 'wizard_mock',
        legacy_metadata: {
          app:     appKey,
          panel:   panelKey,
          app_id:  appId,
          panel_id: panelId,
        },
      })

      if (clientErr) throw new Error(`clients: ${clientErr.message}`)

      // ── Passo 2: accounts (sem source_test_id ainda) ────────────────────────
      const { error: accErr } = await supabase.from('accounts').insert({
        id:               accountId,
        client_id:        clientId,
        source_test_id:   null,        // preenchido no passo 4
        app_id:           appId,
        panel_id:         panelId,
        username:         cred.usuario,
        password_secret:  cred.senha,  // produção deve criptografar com pgcrypto/vault
        m3u_url_secret:   cred.m3u,
        hls_url_secret:   cred.hls,
        device_key:       cred.deviceKey,
        provider:         panelKey,
        provider_code:    cred.codigo,
        max_slots:        4,
        status:           'active',
        activated_at:     cred.agora,
        expires_at:       cred.expiresAt,
        legacy_metadata: {
          app:    appKey,
          panel:  panelKey,
        },
      })

      if (accErr) throw new Error(`accounts: ${accErr.message}`)

      // ── Passo 3: tests (com account_id) ────────────────────────────────────
      const { error: testErr } = await supabase.from('tests').insert({
        id:           testId,
        client_id:    clientId,
        app_id:       appId,
        panel_id:     panelId,
        account_id:   accountId,
        device_type:  'any',
        device_key:   cred.deviceKey,
        provider:     panelKey,
        provider_code: cred.codigo,
        status:       'active',
        source:       'wizard_mock',
        requested_at: cred.agora,
        activated_at: cred.agora,
        expires_at:   cred.expiresAt,
        legacy_metadata: {
          app:      appKey,
          panel:    panelKey,
          username: cred.usuario,
          // senha omitida de propósito
        },
      })

      if (testErr) throw new Error(`tests: ${testErr.message}`)

      // ── Passo 4: atualizar accounts.source_test_id ──────────────────────────
      const { error: updErr } = await supabase
        .from('accounts')
        .update({ source_test_id: testId })
        .eq('id', accountId)

      if (updErr) throw new Error(`accounts.update: ${updErr.message}`)

      // ── Passo 5: account_slots ──────────────────────────────────────────────
      const { error: slotErr } = await supabase.from('account_slots').insert({
        id:          crypto.randomUUID(),
        account_id:  accountId,
        client_id:   clientId,
        slot_number: 1,
        status:      'active',
        device_key:  cred.deviceKey,
        assigned_at: cred.agora,
        expires_at:  cred.expiresAt,
        metadata:    { label: 'Tela 01', source: 'wizard_mock' },
      })

      if (slotErr) throw new Error(`account_slots: ${slotErr.message}`)

      // ── Passo 6: pipeline_events ────────────────────────────────────────────
      const { error: pipeErr } = await supabase.from('pipeline_events').insert({
        id:           crypto.randomUUID(),
        entity_type:  'test',
        entity_id:    testId,
        event_type:   'status_change',
        from_status:  null,
        to_status:    'active',
        payload: {
          client_id:   clientId,
          account_id:  accountId,
          app_id:      appId,
          panel_id:    panelId,
          provider:    panelKey,
          source:      'wizard_mock',
        },
      })

      if (pipeErr) throw new Error(`pipeline_events: ${pipeErr.message}`)

      // ── Passo 7: logs ───────────────────────────────────────────────────────
      const { error: logErr } = await supabase.from('logs').insert({
        id:         crypto.randomUUID(),
        scope:      'wizard',
        level:      'info',
        event:      'test.created.mock',
        client_id:  clientId,
        test_id:    testId,
        account_id: accountId,
        message:    `Teste mock criado para ${nome.trim()} | app=${appKey} panel=${panelKey}`,
        metadata: {
          provider_code: cred.codigo,
          expires_at:    cred.expiresAt,
          source:        'wizard_mock',
        },
      })

      if (logErr) throw new Error(`logs: ${logErr.message}`)

      // Todos os inserts passaram — é seguro dizer "supabase"
      source = 'supabase'

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[api/tests/create-mock] Falha no Supabase, usando mock:', msg)
      // source permanece 'mock' — não retorna "supabase" em caso de falha
    }
  }

  // 4. Montar mensagem por tipo de app — NUNCA expor senha em claro além desta camada
  let mensagem = ''
  if (isManual && manualFields?.text?.trim()) {
    mensagem = manualFields.text.trim()
  } else if (isXCloud) {
    mensagem = [
      `Olá ${nome.trim()}! Segue seu teste de 2 horas:`,
      ``,
      `App: XCloud`,
      `Host: ${finalHost}`,
      `Usuário: ${finalUsuario}`,
      `Senha: ${finalSenha}`,
      `Validade: ${cred.validadeBR}`,
      ``,
      ...(finalDeviceKey ? [`Chave do dispositivo: ${finalDeviceKey}`] : []),
      ``,
      `Qualquer dúvida é só chamar!`,
    ].filter(Boolean).join('\n')
  } else if (isManual) {
    const appLabel = 'Manual'
    mensagem = [
      `Olá ${nome.trim()}! Segue seu acesso:`,
      ``,
      `App: ${appLabel}`,
      ...(finalHost ? [`Host: ${finalHost}`] : []),
      `Usuário: ${finalUsuario}`,
      `Senha: ${finalSenha}`,
      `Código: ${finalCodigo}`,
      `Validade: ${cred.validadeBR}`,
      ``,
      `Qualquer dúvida é só chamar!`,
    ].join('\n')
  } else {
    const appLabel = appKey
    const srvLabel = panelKey
    mensagem = [
      `Olá ${nome.trim()}! Segue seu teste de 2 horas:`,
      ``,
      `App: ${appLabel}`,
      `Servidor: ${srvLabel}`,
      `Código: ${finalCodigo}`,
      `Usuário: ${finalUsuario}`,
      `Senha: ${finalSenha}`,
      `Validade: ${cred.validadeBR}`,
      ``,
      `Qualquer dúvida é só chamar!`,
    ].join('\n')
  }

  return NextResponse.json({
    success: true,
    source,
    client: {
      id:     clientId,
      name:   nome.trim(),
      status: 'active',
    },
    test: {
      id:          testId,
      code:        finalCodigo,
      username:    maskUsername(finalUsuario),
      password:    maskPassword(finalSenha),
      xtream_host: finalHost,
      device_key:  isXCloud ? finalDeviceKey : undefined,
      validadeBR:  cred.validadeBR,
      expires_at:  cred.expiresAt,
      status:      'active',
      mensagem,
    },
    account: {
      id:         accountId,
      provider:   panelKey,
      device_key: finalDeviceKey,
    },
  })
}
