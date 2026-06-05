/**
 * lib/services/masking.ts
 *
 * Funções para mascarar dados sensíveis antes de exibir no painel.
 *
 * CONTEXTO: Senhas, tokens e usuários nunca devem aparecer em claro
 * nas partes públicas da UI. Estas funções são usadas nos componentes
 * de listagem para esconder dados até o usuário clicar em "revelar".
 *
 * ESTADO ATUAL: Já usado nos mocks. Quando vier do Supabase,
 * as mesmas funções continuam sendo aplicadas no front.
 */

/**
 * Mascara uma senha: mostra apenas os 2 primeiros e 2 últimos caracteres.
 * Ex: "K9PL3XQ7AZ" → "K9••••••AZ"
 */
export function maskPassword(value: string): string {
  if (!value || value.length <= 4) return '••••'
  return value.slice(0, 2) + '•'.repeat(Math.max(value.length - 4, 2)) + value.slice(-2)
}

/**
 * Mascara um nome de usuário: mostra apenas o prefixo antes do underscore
 * e a metade final.
 * Ex: "usr_joao291" → "usr_••••91"
 */
export function maskUsername(value: string): string {
  if (!value || value.length <= 4) return '••••'
  const keep = Math.ceil(value.length * 0.3)
  return value.slice(0, keep) + '•'.repeat(value.length - keep - 2) + value.slice(-2)
}

/**
 * Mascara um número de telefone: mostra DDD e os últimos 4 dígitos.
 * Ex: "(22) 99999-1234" → "(22) •••••-1234"
 */
export function maskPhone(value: string): string {
  if (!value) return '••••'
  // Mantém o início (DDD) e os últimos 4 dígitos
  const digits = value.replace(/\D/g, '')
  if (digits.length < 8) return '••••'
  const ddd  = digits.slice(0, 2)
  const last = digits.slice(-4)
  return `(${ddd}) •••••-${last}`
}

/**
 * Mascara um token de API: mostra apenas os primeiros 6 e últimos 4 chars.
 * Ex: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." → "eyJhbG••••J9"
 */
export function maskToken(value: string): string {
  if (!value || value.length <= 10) return '••••••••••'
  return value.slice(0, 6) + '•'.repeat(8) + value.slice(-4)
}

export function maskUrl(value: string): string {
  if (!value) return '••••'
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.hostname}/••••`
  } catch {
    return '••••'
  }
}

export function maskDeviceKey(value: string): string {
  if (!value || value.length <= 6) return '••••••'
  return `${value.slice(0, 2)}${'•'.repeat(6)}${value.slice(-2)}`
}

export function maskSensitiveText(value: string): string {
  if (!value) return value
  return value
    .replace(/https?:\/\/\S+/gi, (match) => maskUrl(match))
    .replace(/\b(m3u8?|hls|token|device[_ -]?key|senha|password|usuario|username)\s*[:=]\s*\S+/gi, '$1=••••')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, (match) => maskToken(match))
}

/**
 * Retorna asteriscos de tamanho fixo — para campos que não devem
 * revelar nem o tamanho real.
 */
export function maskFixed(length = 8): string {
  return '•'.repeat(length)
}
