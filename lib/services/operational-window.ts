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

export function isOperationalNoise(value: unknown): boolean {
  return /worker|codex|mock|teste e2e|e2e|reject|tempor[aá]rio|temporary|teste segunda tela arthur|teste renovacao arthur|teste ativa[cç][aã]o blessed arthur|teste expire idempotente/i.test(String(value || ''))
}

export function isoPlusMinutes(minutes: number, now = new Date()): string {
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString()
}
