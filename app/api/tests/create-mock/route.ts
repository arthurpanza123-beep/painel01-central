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
 * - NÃO cria account nem account_slot.
 * - NÃO chama Ninety, Yellow, Brasil, XCloud, Evolution ou WhatsApp.
 * - NÃO gera teste real em painel externo.
 * - NÃO envia mensagem.
 * - Credenciais são fake/simuladas.
 * - Senhas e usuários são mascarados na resposta.
 *
 * Payload esperado (JSON):
 *   {
 *     clientName: string,     // nome do cliente
 *     phone: string,          // telefone / WhatsApp
 *     app: string,            // 'xcloud' | 'blessed' | 'playsim' | 'smartstb' | 'manual'
 *     provider?: string,      // 'yellow' | 'ninety' | 'cinemax' (obrigatório se não manual)
 *     deviceKey?: string,     // XCloud
 *     manualFields?: { user?: string; pass?: string; code?: string; host?: string; text?: string },
 *     connection_type?: 'xtream' | 'standard'
 *   }
 *
 * Resposta de sucesso (200):
 *   { success: true, source: "supabase"|"mock", client, test }
 *
 * Resposta de erro (400):
 *   { success: false, error: string }
 *
 * Ordem de inserção quando Supabase disponível:
 *   1. clients
 *   2. tests
 *   3. pipeline_events
 *   4. logs
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
  const validadeDate = new Date()
  validadeDate.setHours(validadeDate.getHours() + 2)
  const expiresAt  = validadeDate.toISOString()
  const validadeBR = validadeDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const agora      = new Date().toISOString()
  return { usuario, senha, codigo, deviceKey, expiresAt, validadeBR, agora }
}

const APP_KEYS: Record<string, string> = {
  xcloud:   'xcloud',
  blessed:  'blessed',
  playsim:  'playsim',
  smartstb: 'smartstb',
  manual:   'manual',
}

const PANEL_KEYS: Record<string, string> = {
  yellow:  'yellow',
  ninety:  'ninety',
  cinemax: 'cinemax',
}

// DNS por painel — preenchido no legacy_metadata e na mensagem
const PANEL_DNS: Record<string, string> = {
  yellow:  '209.14.84.25',
  ninety:  '167.114.4.164',
  cinemax: '178.156.160.255',
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    clientName?: string
    phone?: string
    app?: string
    provider?: string
    deviceKey?: string
    manualFields?: { user?: string; pass?: string; code?: string; host?: string; text?: string }
    connection_type?: 'xtream' | 'standard'
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Payload inválido.' }, { status: 400 })
  }

  const { clientName, phone, app, provider, deviceKey, manualFields, connection_type } = body

  if (!clientName?.trim() || !phone?.trim() || !app?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Campos obrigatórios: clientName, phone, app.' },
      { status: 400 },
    )
  }

  const isManual   = app === 'manual'
  const isXCloud   = app === 'xcloud'
  const isSmartStb = app === 'smartstb'

  if (!isManual && !provider?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Campo obrigatório: provider.' },
      { status: 400 },
    )
  }

  // 1. Gerar credenciais fake
  const cred           = gerarCredenciais(clientName)
  const finalDeviceKey = deviceKey?.trim() || cred.deviceKey
  const clientId       = crypto.randomUUID()
  const testId         = crypto.randomUUID()

  const appKey   = APP_KEYS[app]        ?? app
  const panelKey = PANEL_KEYS[provider ?? ''] ?? (provider ?? 'manual')
  const panelDns = PANEL_DNS[panelKey]  ?? ''

  // Credenciais finais (manual pode sobrescrever)
  const finalUsuario = isManual ? (manualFields?.user?.trim() || cred.usuario) : cred.usuario
  const finalSenha   = isManual ? (manualFields?.pass?.trim() || cred.senha)   : cred.senha
  const finalCodigo  = isManual ? (manualFields?.code?.trim() || cred.codigo)  : cred.codigo
  const finalHost    = isManual
    ? (manualFields?.host?.trim() || 'http://painel.exemplo.tv')
    : isSmartStb
      ? panelDns
      : 'http://srv.centralplay.tv'

  // 2. Tentar gravar no Supabase (clients + tests + pipeline_events + logs)
  //    NÃO cria accounts nem account_slots.
  const supabase = getSupabaseServerClient()
  let source: 'supabase' | 'mock' = 'mock'

  if (supabase) {
    try {
      // ── Passo 0: buscar app_id e panel_id nas tabelas de referência ──────
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

      // ── Passo 1: clients ─────────────────────────────────────────────────
      const { error: clientErr } = await supabase.from('clients').insert({
        id:         clientId,
        name:       clientName.trim(),
        phone_e164: phone.trim().replace(/\D/g, '').replace(/^(\d{2})/, '+$1'),
        phone_raw:  phone.trim(),
        status:     'active',
        source:     'wizard_mock',
        legacy_metadata: { app: appKey, panel: panelKey, app_id: appId, panel_id: panelId },
      })
      if (clientErr) throw new Error(`clients: ${clientErr.message}`)

      // ── Passo 2: tests ───────────────────────────────────────────────────
      const { error: testErr } = await supabase.from('tests').insert({
        id:            testId,
        client_id:     clientId,
        app_id:        appId,
        panel_id:      panelId,
        account_id:    null,   // teste não tem account
        device_type:   'any',
        device_key:    isXCloud ? finalDeviceKey : null,
        provider:      panelKey,
        provider_code: finalCodigo,
        status:        'active',
        source:        'wizard_mock',
        requested_at:  cred.agora,
        activated_at:  cred.agora,
        expires_at:    cred.expiresAt,
        legacy_metadata: {
          app:      appKey,
          panel:    panelKey,
          dns:      isSmartStb ? panelDns : null,
          username: cred.usuario,
        },
      })
      if (testErr) throw new Error(`tests: ${testErr.message}`)

      // ── Passo 3: pipeline_events ─────────────────────────────────────────
      const { error: pipeErr } = await supabase.from('pipeline_events').insert({
        id:          crypto.randomUUID(),
        entity_type: 'test',
        entity_id:   testId,
        event_type:  'status_change',
        from_status: null,
        to_status:   'active',
        payload: { client_id: clientId, app_id: appId, panel_id: panelId, provider: panelKey, source: 'wizard_mock' },
      })
      if (pipeErr) throw new Error(`pipeline_events: ${pipeErr.message}`)

      // ── Passo 4: logs ────────────────────────────────────────────────────
      const { error: logErr } = await supabase.from('logs').insert({
        id:        crypto.randomUUID(),
        scope:     'wizard',
        level:     'info',
        event:     'test.created.mock',
        client_id: clientId,
        test_id:   testId,
        message:   `Teste mock criado para ${clientName.trim()} | app=${appKey} panel=${panelKey}`,
        metadata:  { provider_code: finalCodigo, expires_at: cred.expiresAt, source: 'wizard_mock' },
      })
      if (logErr) throw new Error(`logs: ${logErr.message}`)

      source = 'supabase'
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[api/tests/create-mock] Falha no Supabase, usando mock:', msg)
    }
  }

  // 3. Montar mensagem
  let mensagem = ''
  const appLabel = appKey
  const srvLabel = panelKey

  if (isManual && manualFields?.text?.trim()) {
    mensagem = manualFields.text.trim()
  } else if (isXCloud) {
    mensagem = [
      `Teste ativado com sucesso!`,
      ``,
      `Olá ${clientName.trim()}! Segue seu acesso XCloud:`,
      ``,
      `Host: ${finalHost}`,
      `Usuário: ${finalUsuario}`,
      `Senha: ${finalSenha}`,
      `Validade: ${cred.validadeBR}`,
      ``,
      ...(finalDeviceKey ? [`Chave do dispositivo: ${finalDeviceKey}`, ``] : []),
      `Abra o app e clique em RELOAD ou RECARREGAR para ativar.`,
      `Qualquer dúvida é só chamar!`,
    ].filter(s => s !== undefined).join('\n')
  } else if (isSmartStb) {
    mensagem = [
      `Teste ativado com sucesso!`,
      ``,
      `Olá ${clientName.trim()}! Segue seu acesso Smart STB:`,
      ``,
      `Servidor: ${srvLabel}`,
      `DNS: ${panelDns}`,
      `Usuário: ${finalUsuario}`,
      `Senha: ${finalSenha}`,
      `Validade: ${cred.validadeBR}`,
      ``,
      `Qualquer dúvida é só chamar!`,
    ].join('\n')
  } else if (isManual) {
    mensagem = [
      `Teste ativado com sucesso!`,
      ``,
      ...(finalHost ? [`Host: ${finalHost}`] : []),
      `Usuário: ${finalUsuario}`,
      `Senha: ${finalSenha}`,
      `Código: ${finalCodigo}`,
      `Validade: ${cred.validadeBR}`,
      ``,
      `Qualquer dúvida é só chamar!`,
    ].join('\n')
  } else {
    mensagem = [
      `Teste ativado com sucesso!`,
      ``,
      `Olá ${clientName.trim()}! Segue seu acesso ${appLabel}:`,
      ``,
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
      name:   clientName.trim(),
      status: 'active',
    },
    test: {
      id:          testId,
      code:        finalCodigo,
      username:    maskUsername(finalUsuario),
      password:    maskPassword(finalSenha),
      xtream_host: isXCloud ? finalHost : undefined,
      dns:         isSmartStb ? panelDns : undefined,
      device_key:  isXCloud ? finalDeviceKey : undefined,
      validadeBR:  cred.validadeBR,
      expires_at:  cred.expiresAt,
      status:      'active',
      mensagem,
    },
  })
}
