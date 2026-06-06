const OPERATION_TIME_ZONE = 'America/Sao_Paulo'

export function startOfTodayInOperationTZ(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  return new Date(`${year}-${month}-${day}T00:00:00-03:00`)
}

export function operationWindows(now = new Date()) {
  const todayStart = startOfTodayInOperationTZ(now)
  return {
    now,
    todayStart,
    todayStartIso: todayStart.toISOString(),
    last24hIso: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    in30dIso: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    in60dIso: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    in90dIso: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  }
}

// Padrões "estruturais" de QA/automação que nunca são clientes reais.
const STRUCTURAL_NOISE =
  /worker|codex|mock|teste e2e|e2e|reject|tempor[aá]rio|temporary|operador final|recaptura|real xcloud|real blessed|real playsim|teste segunda tela|teste renovacao|teste renovação|teste ativa[cç][aã]o|teste expire idempotente|idempotente/i

// Nomes de teste/QA configuráveis. Edite OPERATIONAL_NOISE_NAMES no ambiente
// para incluir/remover nomes sem deploy de código.
const FALLBACK_NOISE_NAMES = ['arthur', 'cristian', 'robson']

function configuredNoiseNames(): string[] {
  const raw = process.env.OPERATIONAL_NOISE_NAMES
  if (!raw) return FALLBACK_NOISE_NAMES
  return raw
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
}

export function isOperationalNoise(value: unknown): boolean {
  const text = String(value || '').toLowerCase().trim()
  if (!text) return false
  if (STRUCTURAL_NOISE.test(text)) return true
  // Compara por palavra para não esconder, ex., "Arthurina" sem querer.
  const tokens = text.split(/[^a-zà-ú0-9]+/i).filter(Boolean)
  const noiseNames = configuredNoiseNames()
  return tokens.some((token) => noiseNames.includes(token))
}

export function isoPlusMinutes(minutes: number, now = new Date()): string {
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString()
}
