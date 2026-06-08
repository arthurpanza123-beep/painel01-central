import { maskSensitiveText } from '@/lib/services/masking'

import { createProviderAccessFromUrl } from './test-generation/providers/yellow-box'
import type { ProviderTestResult } from './test-generation/types'

type FullAdultProviderInput = {
  panel_key?: string | null
  panel_name?: string | null
  provider?: string | null
  client_name: string
  phone: string
  app_key: string
  device_key?: string | null
}

function normalized(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function fullAdultPanelKey(input: Pick<FullAdultProviderInput, 'panel_key' | 'panel_name' | 'provider'>): 'yellow_box' | 'ninety' | null {
  const key = normalized(`${input.panel_key || ''} ${input.panel_name || ''} ${input.provider || ''}`)
  if (key.includes('ninety') || key.includes('noventa')) return 'ninety'
  if (key.includes('yellow') || key.includes('brasil') || key.includes('pedidospec')) return 'yellow_box'
  return null
}

export function fullAdultApiConfiguredForPanel(input: Pick<FullAdultProviderInput, 'panel_key' | 'panel_name' | 'provider'>): boolean {
  const panel = fullAdultPanelKey(input)
  if (panel === 'yellow_box') return Boolean(String(process.env.YELLOW_BOX_FULL_API_URL || '').trim())
  if (panel === 'ninety') return Boolean(String(process.env.NINETY_FULL_API_URL || '').trim())
  return false
}

export function fullAdultApiMissingMessage(input: Pick<FullAdultProviderInput, 'panel_key' | 'panel_name' | 'provider'>): string {
  const panel = fullAdultPanelKey(input)
  if (panel === 'yellow_box') return 'API completo +18 nao configurada para Yellow Box.'
  if (panel === 'ninety') return 'API completo +18 nao configurada para Ninety.'
  return 'API completo +18 nao configurada para este painel.'
}

export async function createFullAdultAccess(input: FullAdultProviderInput): Promise<ProviderTestResult> {
  const panel = fullAdultPanelKey(input)
  const timeoutMs = Math.max(Number(process.env.FULL_ADULT_API_TIMEOUT_MS || process.env.YELLOW_BOX_TIMEOUT_MS || 30000), 1000)
  const apiUrl = panel === 'yellow_box'
    ? String(process.env.YELLOW_BOX_FULL_API_URL || '').trim()
    : panel === 'ninety'
      ? String(process.env.NINETY_FULL_API_URL || '').trim()
      : ''

  if (!panel || !apiUrl) throw new Error(fullAdultApiMissingMessage(input))

  try {
    return await createProviderAccessFromUrl({
      client_name: input.client_name,
      phone: input.phone,
      app_key: input.app_key,
      device_key: input.device_key || undefined,
      api_url: apiUrl,
      api_key: '',
      timeout_ms: timeoutMs,
      provider_name: panel === 'yellow_box' ? 'yellow_box_full_adult' : 'ninety_full_adult',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(maskSensitiveText(message))
  }
}
