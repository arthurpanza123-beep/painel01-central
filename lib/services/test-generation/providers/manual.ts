import type { GenerateTestInput, ProviderMockResult } from '../types'

function extract(label: RegExp, text: string): string | undefined {
  const match = text.match(label)
  return match?.[1]?.trim()
}

export async function generateManualMock(input: GenerateTestInput): Promise<ProviderMockResult> {
  const text = input.manualText || ''
  const expires = new Date()
  expires.setHours(expires.getHours() + 2)

  return {
    expires_at: expires.toISOString(),
    connection: {
      xtream_host: input.connection?.xtream_host || extract(/(?:host|dns|servidor)\s*[:=-]\s*(https?:\/\/\S+)/i, text),
      xtream_username: input.connection?.xtream_username || extract(/(?:usuario|usuário|user|login)\s*[:=-]\s*([A-Za-z0-9._@-]+)/i, text),
      xtream_password: input.connection?.xtream_password || extract(/(?:senha|password|pass)\s*[:=-]\s*([A-Za-z0-9._@-]+)/i, text),
      provider_code: input.connection?.provider_code || extract(/(?:codigo|código|code)\s*[:=-]\s*([A-Za-z0-9._@-]+)/i, text),
      optional_m3u_url: input.connection?.optional_m3u_url || extract(/(https?:\/\/\S*get\.php\S*)/i, text),
    },
    provider_payload: {
      provider: 'manual',
      mocked: true,
      parsed_from_manual_text: Boolean(text),
      no_external_call: true,
    },
  }
}
