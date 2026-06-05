import type { GenerateTestInput, GenerateTestResult, TestConnection } from './types'

const APP_LABELS: Record<string, string> = {
  xcloud: 'XCloud',
  blessed: 'Blessed Player',
  playsim: 'PlaySim',
  smartstb: 'Smart STB',
  manual: 'Manual',
}

const PROVIDER_LABELS: Record<string, string> = {
  yellowbox: 'Yellow Box',
  ninety: 'Ninety',
  manual: 'Manual',
}

export function buildMessageText(input: GenerateTestInput, connection: TestConnection, expiresAt: string): string {
  const validUntil = new Date(expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const app = APP_LABELS[input.app] || input.app
  const provider = PROVIDER_LABELS[input.provider] || input.provider

  if (input.app === 'manual') {
    return [
      `Teste ativado com sucesso!`,
      ``,
      `Cliente: ${input.clientName}`,
      `Aplicativo: ${app}`,
      `Servidor: ${provider}`,
      input.manualText ? `Dados: conferir texto manual informado pelo operador.` : `Dados: manual`,
      `Validade: ${validUntil}`,
    ].join('\n')
  }

  return [
    `Teste ativado com sucesso!`,
    ``,
    `Cliente: ${input.clientName}`,
    `Aplicativo: ${app}`,
    `Servidor: ${provider}`,
    connection.provider_code ? `Código: ${connection.provider_code}` : null,
    connection.xtream_host ? `Host: ${connection.xtream_host}` : null,
    connection.xtream_username ? `Usuário: ${connection.xtream_username}` : null,
    connection.xtream_password ? `Senha: ${connection.xtream_password}` : null,
    `Validade: ${validUntil}`,
  ].filter(Boolean).join('\n')
}

export function buildPublicResult(result: GenerateTestResult): GenerateTestResult {
  return result
}
