import type { GenerateTestInput, ProviderMockResult } from '../types'

function rand(seed: string, size = 9): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  return String(Math.abs(hash)).padEnd(size, '7').slice(0, size)
}

export async function generateYellowMock(input: GenerateTestInput): Promise<ProviderMockResult> {
  const expires = new Date()
  expires.setHours(expires.getHours() + 2)
  const username = input.connection?.xtream_username || rand(`${input.phone}:${input.clientName}:yellow`)
  const password = input.connection?.xtream_password || rand(`${input.clientName}:${input.phone}:pass`)
  const host = input.connection?.xtream_host || 'https://mock-yellowbox.local'

  return {
    expires_at: expires.toISOString(),
    connection: {
      xtream_host: host,
      xtream_username: username,
      xtream_password: password,
      provider_code: input.connection?.provider_code || (input.app === 'playsim' ? '187052' : '12345670'),
    },
    provider_payload: {
      provider: 'yellowbox',
      mocked: true,
      no_external_call: true,
    },
  }
}
