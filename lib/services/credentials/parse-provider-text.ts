export type ParsedProviderCredentials = {
  rawText: string
  username?: string
  password?: string
  host?: string
  dueAt?: string
  dueAtText?: string
  providerCode?: string
  code?: string
  panelName?: string
  panelKey?: string
  appName?: string
  appKey?: string
  planKey?: string
  screensCount?: 1 | 2
  amount?: number
  confidence: 'low' | 'medium' | 'high'
  warnings: string[]
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function parseBRDate(value: string): string | undefined {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (!match) return undefined
  const [, dd, mm, yyyy, hh = '23', min = '59', ss = '59'] = match
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss))
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function inferPanel(text: string, host: string): Pick<ParsedProviderCredentials, 'panelName' | 'panelKey'> {
  const normalized = normalizeText(`${text} ${host}`)
  if (normalized.includes('yellow') || normalized.includes('overhall') || normalized.includes('pedidospec')) {
    return { panelName: 'Yellow Box', panelKey: 'yellow' }
  }
  if (normalized.includes('devxtop') || normalized.includes('xbr')) {
    return { panelName: 'XBR / DevXTop', panelKey: 'xbr' }
  }
  if (normalized.includes('ninety') || normalized.includes('noventa') || normalized.includes('topkox')) {
    return { panelName: 'Ninety', panelKey: 'ninety' }
  }
  if (normalized.includes('cinemax')) {
    return { panelName: 'CineMax', panelKey: 'cinemax' }
  }
  if (normalized.includes('areaplay') || normalized.includes('sigma')) {
    return { panelName: 'AreaPlay / Sigma', panelKey: 'areaplay' }
  }
  return {}
}

function inferApp(text: string, providerCode: string, code: string): Pick<ParsedProviderCredentials, 'appName' | 'appKey'> {
  const normalized = normalizeText(text)
  if (normalized.includes('xcloud')) return { appName: 'XCloud', appKey: 'xcloud' }
  if (normalized.includes('blessed') || providerCode === '1105') return { appName: 'Blessed Player', appKey: 'blessed' }
  if (normalized.includes('playsim') || normalized.includes('play sim')) return { appName: 'PlaySim', appKey: 'playsim' }
  if (normalized.includes('fun player') || normalized.includes('funplay') || normalized.includes('fun play')) return { appName: 'FunPlay', appKey: 'funplay' }
  if (normalized.includes('assist')) return { appName: 'Assist+', appKey: 'assist_plus' }
  if (code === '187052') return { appName: 'PlaySim', appKey: 'playsim' }
  return {}
}

function inferPlan(text: string): Pick<ParsedProviderCredentials, 'planKey' | 'screensCount' | 'amount'> {
  const normalized = normalizeText(text)
  const planKey = normalized.includes('anual') ? 'anual'
    : normalized.includes('semestral') ? 'semestral'
      : normalized.includes('trimestral') ? 'trimestral'
        : normalized.includes('mensal') ? 'mensal'
          : undefined
  const screensCount = /2\s*telas?|duas\s*telas?/.test(normalized) ? 2 : /1\s*tela|uma\s*tela/.test(normalized) ? 1 : undefined
  const amountMatch = text.match(/R\$\s*([0-9]+(?:[,.][0-9]{1,2})?)/i)
  const amount = amountMatch?.[1] ? Number(amountMatch[1].replace('.', '').replace(',', '.')) : undefined
  return { planKey, screensCount, amount }
}

export function parseProviderText(rawText: string): ParsedProviderCredentials {
  const text = String(rawText || '').trim()
  const username = firstMatch(text, [
    /(?:usu[aá]rio|usuario|user|login)\s*[:\-]\s*([^\s]+)/i,
  ])
  const password = firstMatch(text, [
    /(?:senha|password|pass)\s*[:\-]\s*([^\s]+)/i,
  ])
  const host = firstMatch(text, [
    /(?:dns\/host|host\/dns|dns|host|url)\s*[:\-]\s*(https?:\/\/[^\s]+)/i,
    /(https?:\/\/[^\s]+)/i,
  ])
  const dueAtText = firstMatch(text, [
    /(?:vencimento|validade|vence em|venc\.)\s*[:\-]\s*([0-9/:\s]+)/i,
  ])
  const providerCode = firstMatch(text, [
    /provider(?:\s+blessed)?\s*[:\-]\s*([a-z0-9]+)/i,
  ])
  const code = firstMatch(text, [
    /(?:code|codigo|c[oó]digo)(?:\s+playsim)?\s*[:\-]\s*([a-z0-9]+)/i,
  ])

  const panel = inferPanel(text, host)
  const app = inferApp(text, providerCode, code)
  const plan = inferPlan(text)
  const warnings: string[] = []
  if (!username) warnings.push('Usuario nao identificado.')
  if (!password) warnings.push('Senha nao identificada.')
  if (!host) warnings.push('Host/DNS nao identificado.')
  if (!panel.panelKey) warnings.push('Painel provavel nao identificado.')
  if (!app.appKey) warnings.push('App provavel nao identificado.')
  const requiredFound = [username, password, host].filter(Boolean).length
  const confidence = requiredFound >= 3 && panel.panelKey && app.appKey ? 'high' : requiredFound >= 2 ? 'medium' : 'low'

  return {
    rawText: text,
    username: username || undefined,
    password: password || undefined,
    host: host || undefined,
    dueAt: dueAtText ? parseBRDate(dueAtText) : undefined,
    dueAtText: dueAtText || undefined,
    providerCode: providerCode || undefined,
    code: code || undefined,
    ...panel,
    ...app,
    ...plan,
    confidence,
    warnings,
  }
}
