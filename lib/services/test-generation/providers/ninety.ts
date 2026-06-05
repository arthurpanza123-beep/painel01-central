import type { GenerateTestInput, ProviderMockResult } from '../types'

function token(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, 10) || 'cliente'
}

export async function generateNinetyMock(input: GenerateTestInput): Promise<ProviderMockResult> {
  const expires = new Date()
  expires.setHours(expires.getHours() + 2)
  const base = token(input.clientName)

  return {
    expires_at: expires.toISOString(),
    connection: {
      xtream_host: input.connection?.xtream_host || 'https://mock-ninety.local',
      xtream_username: input.connection?.xtream_username || `${base}${input.phone.replace(/\D/g, '').slice(-4)}`,
      xtream_password: input.connection?.xtream_password || `${base}123`,
      provider_code: input.connection?.provider_code || 'xcloud',
    },
    provider_payload: {
      provider: 'ninety',
      mocked: true,
      no_external_call: true,
    },
  }
}
