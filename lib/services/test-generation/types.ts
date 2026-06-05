export type TestApp = 'xcloud' | 'blessed' | 'playsim' | 'funplay' | 'smartstb' | 'manual'

export type TestProvider = 'yellowbox' | 'ninety' | 'manual'

export type ConnectionType = 'xtream' | 'provider_code' | 'manual'

export type TestGenerationStepId =
  | 'validating_client'
  | 'requesting_provider_test'
  | 'receiving_xtream_credentials'
  | 'receiving_app_credentials'
  | 'preparing_xcloud_access'
  | 'configuring_xcloud_device'
  | 'saving_supabase'
  | 'preparing_message'

export type TestGenerationStep = {
  id: TestGenerationStepId
  label: string
  status: 'pending' | 'running' | 'done' | 'skipped'
}

export type TestConnection = {
  xtream_host?: string
  xtream_username?: string
  xtream_password?: string
  provider_code?: string
  optional_m3u_url?: string
  optional_hls_url?: string
}

export type GenerateTestInput = {
  clientName: string
  phone: string
  app: TestApp
  provider: TestProvider
  deviceKey?: string
  manualText?: string
  connection?: Partial<TestConnection>
}

export type GenerateTestResult = {
  success: boolean
  testId: string
  clientId: string
  app: TestApp
  provider: TestProvider
  connection_type: ConnectionType
  xtream_host?: string
  xtream_username?: string
  xtream_password?: string
  provider_code?: string
  optional_m3u_url?: string
  optional_hls_url?: string
  expires_at: string
  messageText: string
  steps: TestGenerationStep[]
  legacy_metadata: Record<string, unknown>
}

export type ProviderMockResult = {
  connection: TestConnection
  expires_at: string
  provider_payload: Record<string, unknown>
}

export type ProviderTestResult = {
  order_id?: string
  host?: string
  username: string
  password: string
  provider_code?: string
  dns?: string
  expires_at: string
  optional_m3u_url?: string
  optional_hls_url?: string
  raw_provider_response: Record<string, unknown>
}
