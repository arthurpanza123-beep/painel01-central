export type DeviceKeyDiagnostics = {
  length: number
  changed_by_normalization: boolean
  removed_invisible_or_space: boolean
  contains_digit_zero: boolean
  contains_letter_o: boolean
  accepted_short_six_chars: boolean
}

const INVISIBLE_OR_SPACE_RE = /[\s\u00a0\u1680\u180e\u2000-\u200f\u2028\u2029\u202f\u205f\u2060\ufeff]+/g
const HAS_INVISIBLE_OR_SPACE_RE = /[\s\u00a0\u1680\u180e\u2000-\u200f\u2028\u2029\u202f\u205f\u2060\ufeff]+/

export function normalizeXcloudDeviceKey(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    .replace(INVISIBLE_OR_SPACE_RE, '')
    .toUpperCase()
    .trim()
}

export function xcloudDeviceKeyDiagnostics(original: unknown, normalized = normalizeXcloudDeviceKey(original)): DeviceKeyDiagnostics {
  const raw = String(original || '')
  return {
    length: normalized.length,
    changed_by_normalization: raw !== normalized,
    removed_invisible_or_space: HAS_INVISIBLE_OR_SPACE_RE.test(raw),
    contains_digit_zero: normalized.includes('0'),
    contains_letter_o: normalized.includes('O'),
    accepted_short_six_chars: normalized.length === 6,
  }
}

export function xcloudDeviceKeyValidationError(deviceKey: string): string | null {
  if (!deviceKey) return 'device_key e obrigatoria para XCloud.'
  if (deviceKey.length < 6) return 'device_key XCloud deve ter pelo menos 6 caracteres.'
  if (!/^[A-Z0-9]+$/.test(deviceKey)) return 'device_key XCloud deve conter apenas letras e numeros.'
  return null
}
