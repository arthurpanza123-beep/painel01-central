import { generateManualMock } from './providers/manual'
import { generateNinetyMock } from './providers/ninety'
import { generateYellowMock } from './providers/yellow'
import { buildMessageText } from './message-template'
import { prepareXcloudActivationMock, xtreamToM3u } from './xcloud/activate-xcloud'
import { buildGenerationSteps } from './xcloud/steps'
import type { GenerateTestInput, GenerateTestResult, ProviderMockResult, TestConnection } from './types'

function assertInput(input: GenerateTestInput): void {
  if (!input.clientName?.trim()) throw new Error('clientName obrigatório.')
  if (!input.phone?.trim()) throw new Error('phone obrigatório.')
  if (!input.app) throw new Error('app obrigatório.')
  if (!input.provider) throw new Error('provider obrigatório.')
}

async function callProviderMock(input: GenerateTestInput): Promise<ProviderMockResult> {
  if (input.provider === 'manual' || input.app === 'manual') return generateManualMock(input)
  if (input.provider === 'ninety') return generateNinetyMock(input)
  return generateYellowMock(input)
}

function resolveConnectionType(input: GenerateTestInput, connection: TestConnection): 'xtream' | 'provider_code' | 'manual' {
  if (input.app === 'manual' || input.provider === 'manual') return 'manual'
  if (connection.xtream_host && connection.xtream_username && connection.xtream_password) return 'xtream'
  return 'provider_code'
}

export async function generateTest(input: GenerateTestInput): Promise<GenerateTestResult> {
  assertInput(input)

  const providerResult = await callProviderMock(input)
  const connection: TestConnection = {
    ...providerResult.connection,
    ...input.connection,
  }

  if (!connection.optional_m3u_url && connection.xtream_host && connection.xtream_username && connection.xtream_password) {
    connection.optional_m3u_url = xtreamToM3u(connection)
  }

  const xcloudPlan = input.app === 'xcloud'
    ? prepareXcloudActivationMock(connection, input.deviceKey)
    : null

  const expiresAt = providerResult.expires_at
  const connectionType = resolveConnectionType(input, connection)

  return {
    success: true,
    testId: crypto.randomUUID(),
    clientId: crypto.randomUUID(),
    app: input.app,
    provider: input.provider,
    connection_type: connectionType,
    xtream_host: connection.xtream_host,
    xtream_username: connection.xtream_username,
    xtream_password: connection.xtream_password,
    provider_code: connection.provider_code,
    optional_m3u_url: connection.optional_m3u_url,
    optional_hls_url: connection.optional_hls_url,
    expires_at: expiresAt,
    messageText: buildMessageText(input, connection, expiresAt),
    steps: buildGenerationSteps(input.app),
    legacy_metadata: {
      source: 'test_generation_mock',
      no_external_call: true,
      no_real_test_generated: true,
      test_does_not_consume_slot: true,
      provider_payload: providerResult.provider_payload,
      xcloud_plan: xcloudPlan,
      technical_connection: {
        connection_type: connectionType,
        has_xtream_host: Boolean(connection.xtream_host),
        has_xtream_username: Boolean(connection.xtream_username),
        has_xtream_password: Boolean(connection.xtream_password),
        has_provider_code: Boolean(connection.provider_code),
        has_optional_m3u_url: Boolean(connection.optional_m3u_url),
        has_optional_hls_url: Boolean(connection.optional_hls_url),
      },
    },
  }
}
