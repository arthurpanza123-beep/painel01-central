import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const root = process.cwd()
const sourceFile = path.join(root, 'lib/config/provider-catalog.ts')
const source = fs.readFileSync(sourceFile, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
})

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-catalog-'))
const tempFile = path.join(tempDir, 'provider-catalog.cjs')
fs.writeFileSync(tempFile, compiled.outputText)
const { buildProviderCredentials, listCompatibleApps, getProviderPanelUrl, getProviderSmartTvDns, getProviderWebPlayers } = require(tempFile)

const examples = [
  ['Yellow novo + Blessed', { provider: 'YELLOW_NOVO', app: 'Blessed Player', username: 'usuario1', password: 'senha1', host: 'http://overhall.fun:80' }],
  ['Yellow novo + PlaySim', { provider: 'YELLOW_NOVO', app: 'PlaySim', username: 'usuario2', password: 'senha2', host: 'http://overhall.fun:80' }],
  ['Yellow novo + Smarters iOS', { provider: 'YELLOW_NOVO', app: 'Smarters Player Lite iOS', username: 'usuario3', password: 'senha3', host: 'http://overhall.fun:80' }],
  ['Yellow antigo + Blessed', { provider: 'YELLOW_X3_ANTIGO', app: 'Blessed Player', username: 'usuario4', password: 'senha4', host: 'http://x3box.top' }],
  ['Ninety + Lotus', { provider: 'NINETY', app: 'Lotus', username: 'usuario5', password: 'senha5', host: 'http://topkox.click' }],
  ['XBR + Magic Player', { provider: 'XBR_DEVXTOP', app: 'Magic Player', username: 'usuario6', password: 'senha6', host: 'http://devicemini.ink' }],
  ['XBR + Blessed', { provider: 'XBR_DEVXTOP', app: 'Blessed Player', username: 'usuario7', password: 'senha7', host: 'http://devicemini.ink' }],
  ['AreaPlay + Smarters', { provider: 'AREAPLAY_SIGMA', app: 'IPTV Smarters e afins', username: 'usuario8', password: 'senha8' }],
  ['CineMax + Fun Player', { provider: 'CINEMAX', app: 'Fun Player', username: 'usuario9', password: 'senha9', host: 'http://dnsmax.top' }],
  ['CineMax + Smart STB', { provider: 'CINEMAX', app: 'Smart UP / Smart STB', username: 'usuario10', password: 'senha10', host: 'http://dnsmax.top' }],
]

const output = examples.map(([label, input]) => {
  const built = buildProviderCredentials(input)
  if (!built.panelUrl) throw new Error(`${label}: missing panelUrl`)
  if (!built.app) throw new Error(`${label}: missing app`)
  return {
    label,
    app: built.app,
    provider: built.providerName,
    providerCode: built.providerCode,
    code: built.code,
    username: built.username,
    password: built.password,
    host: built.host,
    dns: built.dns,
    panelUrl: built.panelUrl,
    webPlayers: built.webPlayers,
    m3uUrl: built.m3uUrl,
    hlsUrl: built.hlsUrl,
    ssiptvUrl: built.ssiptvUrl,
    installHint: built.installHint,
  }
})

const summary = {
  providers: ['YELLOW_NOVO', 'YELLOW_X3_ANTIGO', 'CINEMAX', 'NINETY', 'XBR_DEVXTOP', 'AREAPLAY_SIGMA'].map((provider) => ({
    provider,
    panelUrl: getProviderPanelUrl(provider),
    smartTvDns: getProviderSmartTvDns(provider),
    webPlayers: getProviderWebPlayers(provider),
    apps: listCompatibleApps(provider).map((app) => app.name),
  })),
  examples: output,
}

console.log(JSON.stringify(summary, null, 2))
