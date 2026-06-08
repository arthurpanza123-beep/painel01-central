export type ParsedProviderCredentials = {
  rawText: string
  username?: string
  password?: string
  host?: string
  smartTvDns?: string
  webPlayer?: string
  checkoutUrl?: string
  dueAt?: string
  dueAtText?: string
  providerCode?: string
  code?: string
  rp725Code?: string
  panelName?: string
  panelKey?: string
  appName?: string
  appKey?: string
  planKey?: string
  screensCount?: 1 | 2
  amount?: number
  packageType?: 'no_adult' | 'full_adult'
  adultContent?: boolean
  confidence: 'low' | 'medium' | 'high'
  warnings: string[]
}

const MASKED_VALUE_RE = /^(?:\*+|x{3,}|X{3,}|-+|_+|•+|●+)$/

function cleanValue(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^[*_`"'\s]+/g, '')
    .replace(/[*_`"',.;\s]+$/g, '')
    .trim()
}

function validValue(value: unknown): string {
  const text = cleanValue(value)
  if (!text) return ''
  if (/^(?:null|undefined)$/i.test(text)) return ''
  if (MASKED_VALUE_RE.test(text)) return ''
  return text
}

function cleanUrl(value: unknown): string {
  return cleanValue(value).replace(/[)\]}]+$/g, '')
}

function urlsFromText(text: string): string[] {
  return (text.match(/https?:\/\/[^\s*]+/gi) || []).map(cleanUrl).filter(Boolean)
}

function lineValue(lines: string[], label: RegExp, options: { skip?: RegExp } = {}): string {
  for (const line of lines) {
    const normalized = normalizeText(line)
    if (options.skip?.test(normalized)) continue
    const match = line.match(label)
    if (match?.[1]) {
      const value = validValue(match[1])
      if (value) return value
    }
  }
  return ''
}

function hasMaskedLineValue(lines: string[], label: RegExp, options: { skip?: RegExp } = {}): boolean {
  for (const line of lines) {
    const normalized = normalizeText(line)
    if (options.skip?.test(normalized)) continue
    const match = line.match(label)
    if (!match) continue
    if (!validValue(match[1] || '')) return true
  }
  return false
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function parseBRDateSaoPaulo(value: string): string | undefined {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (!match) return undefined
  const [, dd, mm, yyyy, hh = '23', min = '59', ss = '59'] = match
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh) + 3, Number(min), Number(ss)))
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function firstLabeledUrl(lines: string[], matcher: (normalizedLine: string) => boolean): string {
  for (const line of lines) {
    const normalized = normalizeText(line)
    if (!matcher(normalized)) continue
    const url = line.match(/https?:\/\/[^\s*]+/i)?.[0]
    if (url) return cleanUrl(url)
  }
  return ''
}

function hostFromM3u(urls: string[]): { host?: string; username?: string; password?: string } {
  for (const url of urls) {
    if (!/\/get\.php/i.test(url)) continue
    try {
      const parsed = new URL(url)
      const username = validValue(parsed.searchParams.get('username') || '')
      const password = validValue(parsed.searchParams.get('password') || '')
      return {
        host: `${parsed.protocol}//${parsed.host}`,
        username: username || undefined,
        password: password || undefined,
      }
    } catch {
      // Ignore malformed URLs from pasted panel text.
    }
  }
  return {}
}

function webPlayerFromLines(lines: string[]): string {
  for (let index = 0; index < lines.length; index += 1) {
    const normalized = normalizeText(lines[index] || '')
    if (!normalized.includes('web player')) continue
    const sameLine = (lines[index] || '').match(/https?:\/\/[^\s*]+/i)?.[0]
    if (sameLine) return cleanUrl(sameLine)
    for (let offset = 1; offset <= 3; offset += 1) {
      const next = lines[index + offset] || ''
      const url = next.match(/https?:\/\/[^\s*]+/i)?.[0]
      if (url) return cleanUrl(url)
    }
  }
  return ''
}

function codeInSection(lines: string[], section: RegExp): string {
  for (let index = 0; index < lines.length; index += 1) {
    if (!section.test(normalizeText(lines[index] || ''))) continue
    for (let offset = 1; offset <= 8; offset += 1) {
      const line = lines[index + offset] || ''
      const normalized = normalizeText(line)
      if (/downloader|ntdown|m7|xs control|adultos?/.test(normalized)) continue
      const match = line.match(/(?:code|c[oó]digo|codigo)\s*\*?\s*[:=\-]\s*\*?\s*([A-Za-z0-9._-]+)/i)
      const value = validValue(match?.[1] || '')
      if (value) return value
    }
  }
  return ''
}

function inferPanel(text: string, host: string): Pick<ParsedProviderCredentials, 'panelName' | 'panelKey'> {
  const normalized = normalizeText(`${text} ${host}`)
  if (normalized.includes('yellow') || normalized.includes('overhall') || normalized.includes('pedidospec') || normalized.includes('recordsway')) {
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

function inferPackage(text: string): Pick<ParsedProviderCredentials, 'packageType' | 'adultContent'> {
  const normalized = normalizeText(text)
  if (/sem\s*(adulto|\+?\s*18|adult)|no\s*adult/.test(normalized)) {
    return { packageType: 'no_adult', adultContent: false }
  }
  if (/(completo|full|premium).{0,20}(\+?\s*18|adulto|adult)|(\+?\s*18|adulto|adult).{0,20}(completo|full|premium)/.test(normalized)) {
    return { packageType: 'full_adult', adultContent: true }
  }
  return {}
}

export function parseProviderText(rawText: string): ParsedProviderCredentials {
  const text = String(rawText || '').trim()
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const urls = urlsFromText(text)
  const m3u = hostFromM3u(urls)

  const usernameLabel = /(?:usu[aá]rio|usuario|username|user|login)\s*\*?\s*[:=\-]\s*(.*)$/i
  const passwordLabel = /(?:senha|password|pass)\s*\*?\s*[:=\-]\s*(.*)$/i
  const usernameMasked = hasMaskedLineValue(lines, usernameLabel, { skip: /link|url|senha adultos?/ })
  const passwordMasked = hasMaskedLineValue(lines, passwordLabel, { skip: /adultos?|link|url/ })
  const username = usernameMasked ? '' : lineValue(lines, /(?:usu[aá]rio|usuario|username|user|login)\s*\*?\s*[:=\-]\s*\*?\s*([^\s*]+)/i, { skip: /link|url|senha adultos?/ }) || m3u.username || ''
  const password = passwordMasked ? '' : lineValue(lines, /(?:senha|password|pass)\s*\*?\s*[:=\-]\s*\*?\s*([^\s*]+)/i, { skip: /adultos?|link|url/ }) || m3u.password || ''
  const host = firstLabeledUrl(lines, (line) =>
    /\b(?:dns|host|enter url)\b/.test(line) &&
    !/dns\s*(?:smart|stb)|smart\s*(?:up|stb)|web player|checkout|assinar|renovar|link m3u|link hls|ssiptv|link direto/.test(line)
  ) || m3u.host || ''
  const smartTvDns = lineValue(lines, /(?:dns\s*smart\s*up\s*\/?\s*smart\s*stb|dns\s*smart|smart\s*up|smart\s*stb)\s*\*?\s*[:=\-]\s*\*?\s*([A-Za-z0-9.:/_-]+)/i)
  const webPlayer = webPlayerFromLines(lines)
  const checkoutUrl = firstLabeledUrl(lines, (line) => /checkout|assinar|renovar/.test(line))
  const dueAtText = lineValue(lines, /(?:vencimento|validade|vence em|venc\.)\s*\*?\s*[:=\-]\s*\*?\s*([0-9/:\s]+)/i)
  const providerCode = lineValue(lines, /provider(?:\s+blessed)?\s*\*?\s*[:=\-]\s*\*?\s*([A-Za-z0-9._-]+)/i)
  const playsimCode = codeInSection(lines, /playsim|play sim|assist/)
  const rp725Code = codeInSection(lines, /rp725/)
  const firstCode = lineValue(lines, /(?:code|c[oó]digo|codigo)(?:\s+playsim)?\s*\*?\s*[:=\-]\s*\*?\s*([A-Za-z0-9._-]+)/i, { skip: /downloader|ntdown|m7|xs control|adultos?/ })
  const code = playsimCode || firstCode

  const panel = inferPanel(text, host)
  const app = inferApp(text, providerCode, code)
  const plan = inferPlan(text)
  const pkg = inferPackage(text)
  const warnings: string[] = []
  if (!username) warnings.push('Usuario nao identificado.')
  if (!password) warnings.push('Senha nao identificada.')
  if (!host) warnings.push('Host/DNS nao identificado.')
  if (usernameMasked || passwordMasked) warnings.push('Credencial mascarada ignorada.')
  if (!panel.panelKey) warnings.push('Painel provavel nao identificado.')
  if (!app.appKey) warnings.push('App provavel nao identificado.')
  const requiredFound = [username, password, host].filter(Boolean).length
  const confidence = requiredFound >= 3 && panel.panelKey && app.appKey ? 'high' : requiredFound >= 2 ? 'medium' : 'low'

  return {
    rawText: text,
    username: username || undefined,
    password: password || undefined,
    host: host || undefined,
    smartTvDns: smartTvDns || undefined,
    webPlayer: webPlayer || undefined,
    checkoutUrl: checkoutUrl || undefined,
    dueAt: dueAtText ? parseBRDateSaoPaulo(dueAtText) : undefined,
    dueAtText: dueAtText || undefined,
    providerCode: providerCode || undefined,
    code: code || undefined,
    rp725Code: rp725Code || undefined,
    ...panel,
    ...app,
    ...plan,
    ...pkg,
    confidence,
    warnings,
  }
}
