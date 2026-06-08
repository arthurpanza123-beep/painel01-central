const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

require.extensions['.ts'] = function compileTs(module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  })
  module._compile(output.outputText, filename)
}

const { parseProviderText } = require(path.resolve(__dirname, '../lib/services/credentials/parse-provider-text.ts'))

const DEFAULT_FIXTURE = `
🔰 *Bem-vindo a Yellow BoX* 🔰

🚹 *Usuário:* 12345678
🔐 *Senha:* 87654321

📦 *Plano:* 02 - PACOTE COMPLETO - SEM ADULTOS [1 MÊS]
💳 *Assinar/Renovar Plano:* https://pedidospec.online/#/checkout/V4D34O5Waq/YB1wvverWv
💵 *Preço do Plano:* R$ 30,00
🗓️ *Vencimento:* 07/07/2026 23:59:59
__________________________________________
🟠 *DNS:* http://recordsway.shop:80
🟠 *DNS SMART UP / SMART STB:* 209.14.84.25
__________________________________________
✅ *WEB PLAYER:*
🟠 http://web.appnovo.top
__________________________________________
✅ *PLAYLIST'S:*

🌐 *Link M3U: http://recordsway.shop:80/get.php?username=12345678&password=87654321&type=m3u_plus&output=mpegts

🔰 *BLESSED PLAYER* 🔰
🟠 *PROVIDER:* 1105
🚹 *USERNAME:* 12345678
🔐 *PASSWORD:* 87654321

🔰 *PLAYSIM* ou *ASSIST+* 🔰
🟠 *CODE:* 187052
🚹 *USERNAME:* 12345678
🔐 *PASSWORD:* 87654321

🔰 *RP725* 🔰
🟠 *CODE:* 12345670
🚹 *USERNAME:* 12345678
🔐 *PASSWORD:* 87654321
`

function readFixture() {
  const fixtureFile = process.argv[2] || process.env.YELLOW_PARSER_FIXTURE_FILE
  if (fixtureFile) return fs.readFileSync(fixtureFile, 'utf8')
  if (!process.stdin.isTTY) {
    const piped = fs.readFileSync(0, 'utf8')
    if (piped.trim()) return piped
  }
  return DEFAULT_FIXTURE
}

function displayDate(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(date)
}

function mask(value) {
  const text = String(value || '')
  return text ? `<present:${text.length}>` : ''
}

const parsed = parseProviderText(readFixture())
const expected = process.env.EXPECTED_JSON
  ? JSON.parse(process.env.EXPECTED_JSON)
  : {
      username: '12345678',
      password: '87654321',
      providerCode: '1105',
      code: '187052',
      host: 'http://recordsway.shop:80',
      smartTvDns: '209.14.84.25',
      webPlayer: 'http://web.appnovo.top',
      checkoutUrl: 'https://pedidospec.online/#/checkout/V4D34O5Waq/YB1wvverWv',
      dueDateDisplay: '07/07/2026',
    }

const actual = {
  username: parsed.username,
  password: parsed.password,
  providerCode: parsed.providerCode,
  code: parsed.code,
  rp725Code: parsed.rp725Code,
  host: parsed.host,
  smartTvDns: parsed.smartTvDns,
  webPlayer: parsed.webPlayer,
  checkoutUrl: parsed.checkoutUrl,
  dueAt: parsed.dueAt,
  dueDateDisplay: displayDate(parsed.dueAt),
  amount: parsed.amount,
  panelName: parsed.panelName,
  packageType: parsed.packageType,
  adultContent: parsed.adultContent,
}

const failures = Object.entries(expected)
  .filter(([key, value]) => actual[key] !== value)
  .map(([key, value]) => ({ key, expected: value, actual: actual[key] }))

const maskedFallback = parseProviderText([
  'Usuário: *',
  'Senha: *',
  'DNS: http://recordsway.shop:80',
  'Link M3U: http://recordsway.shop:80/get.php?username=12345678&password=87654321&type=m3u_plus',
  'PROVIDER: 1105',
].join('\n'))
if (maskedFallback.username || maskedFallback.password) {
  failures.push({
    key: 'masked_credentials',
    expected: 'blocked',
    actual: `username=${maskedFallback.username || ''};password=${mask(maskedFallback.password)}`,
  })
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  parsed: {
    ...actual,
    password: mask(actual.password),
  },
  failures,
}, null, 2))

if (failures.length) process.exit(1)
