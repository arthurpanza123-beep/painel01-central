import type { TestConnection } from '../types'

export type XcloudActivationPlan = {
  mode: 'mock_xtream_prepared'
  requiresDeviceKey: boolean
  customPlaylistUrlTemplate: string
  technicalM3uUrl?: string
  notes: string[]
}

export function xtreamToM3u(connection: TestConnection): string | undefined {
  const host = String(connection.xtream_host || '').replace(/\/+$/, '')
  const username = String(connection.xtream_username || '').trim()
  const password = String(connection.xtream_password || '').trim()
  if (!host || !username || !password) return undefined
  return `${host}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=mpegts`
}

export function prepareXcloudActivationMock(connection: TestConnection, deviceKey?: string): XcloudActivationPlan {
  return {
    mode: 'mock_xtream_prepared',
    requiresDeviceKey: true,
    customPlaylistUrlTemplate: 'XCLOUD_CUSTOM_PLAYLIST_URL',
    technicalM3uUrl: connection.optional_m3u_url || xtreamToM3u(connection),
    notes: [
      deviceKey ? 'device_key_received_but_not_used_in_mock' : 'device_key_missing_for_real_xcloud',
      'real_playwright_activation_disabled',
      'xtream_is_primary_operator_format',
    ],
  }
}
