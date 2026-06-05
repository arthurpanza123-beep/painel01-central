export type ProviderKey =
  | 'YELLOW_NOVO'
  | 'YELLOW_X3_ANTIGO'
  | 'CINEMAX'
  | 'NINETY'
  | 'XBR_DEVXTOP'
  | 'AREAPLAY_SIGMA'

export type DeviceKey =
  | 'samsung'
  | 'lg'
  | 'roku'
  | 'ios'
  | 'android'
  | 'android_tv'
  | 'google_tv'
  | 'tv_box'
  | 'fire_stick'
  | 'mi_stick'
  | 'pc'
  | 'smart_stb'
  | 'smart_up'
  | 'smart_tv_antiga'
  | 'windows'

export type CredentialField = 'provider' | 'code' | 'name' | 'dns' | 'host' | 'username' | 'password' | 'url'

export type ProviderApp = {
  key: string
  name: string
  aliases?: string[]
  priority?: number
  recommended?: boolean
  devices?: DeviceKey[]
  fields: CredentialField[]
  providerCode?: string
  code?: string
  link?: string
  downloader?: string
  ntdown?: string
  m7Downloads?: string
  xsControl?: string
  dns?: string
  url?: string
  adultPassword?: string
  installHint?: string
  notes?: string
}

export type DnsOption = {
  value: string
  label?: string
}

export type ProviderCatalogEntry = {
  key: ProviderKey
  name: string
  aliases: string[]
  panelUrl: string
  checkoutUrlBase?: string
  defaultHost?: string
  dnsSmartStb?: DnsOption[]
  dnsXciptv?: string
  dnsSmarters?: string
  dnsXciptvSmartersNotRecommended?: string
  webPlayers?: string[]
  webPlayerCode?: string
  apps: ProviderApp[]
  m3uOutput?: 'mpegts' | 'ts'
  ssiptvBaseUrl?: string
  internalNotes?: string
}

export type CredentialInput = {
  provider: ProviderKey | string
  app?: string
  username?: string
  password?: string
  host?: string
}

export type BuiltCredentials = {
  providerKey: ProviderKey
  providerName: string
  app: string
  appKey: string
  panelUrl: string
  providerCode?: string
  code?: string
  username?: string
  password?: string
  host?: string
  dns?: string
  smartStbDns?: DnsOption[]
  webPlayers: string[]
  m3uUrl?: string
  hlsUrl?: string
  ssiptvUrl?: string
  link?: string
  downloader?: string
  ntdown?: string
  m7Downloads?: string
  xsControl?: string
  adultPassword?: string
  fields: CredentialField[]
  installHint: string
}

const ALL_TV_DEVICES: DeviceKey[] = ['samsung', 'lg', 'roku']
const ANDROID_BOX_DEVICES: DeviceKey[] = ['android', 'android_tv', 'google_tv', 'tv_box', 'fire_stick', 'mi_stick']
const SMART_TV_DNS_DEVICES: DeviceKey[] = ['smart_stb', 'smart_up', 'smart_tv_antiga']

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    key: 'YELLOW_NOVO',
    name: 'Yellow Box',
    aliases: ['yellow', 'yellow box', 'brasil yellow', 'brasil / yellow box', 'brasil_yellow', 'yellow novo'],
    panelUrl: 'https://pedidospec.online/#/customers',
    defaultHost: 'http://overhall.fun:80',
    dnsSmartStb: [{ value: '209.14.84.25' }],
    webPlayers: ['http://web.appnovo.top'],
    m3uOutput: 'mpegts',
    internalNotes: 'Yellow novo: Blessed usa provider 1105; PlaySim/Assist+ usam code 187052.',
    apps: [
      { key: 'blessed', name: 'Blessed Player', aliases: ['blessed'], providerCode: '1105', fields: ['provider', 'username', 'password'], devices: ['samsung', 'lg', 'roku', 'ios'], recommended: true, priority: 10, installHint: 'Informe provider 1105, usuario e senha.' },
      { key: 'playsim', name: 'PlaySim', aliases: ['play sim'], code: '187052', fields: ['code', 'username', 'password'], devices: ALL_TV_DEVICES, priority: 20, installHint: 'Informe codigo 187052, usuario e senha.' },
      { key: 'assist_plus', name: 'Assist+', aliases: ['assist plus', 'assisti plus'], code: '187052', fields: ['code', 'username', 'password'], devices: ALL_TV_DEVICES, priority: 30, installHint: 'Informe codigo 187052, usuario e senha.' },
      { key: 'rp725', name: 'RP725', code: '12345670', link: 'https://play.google.com/store/apps/details?id=rp.rp725&hl=pt_BR', fields: ['code', 'username', 'password'], devices: ['android'], installHint: 'Use codigo 12345670 com usuario e senha.' },
      { key: 'yellow_ibo_x', name: 'Yellow IBO X', link: 'https://tinyurl.com/yarpvw7x', downloader: '3829213', ntdown: '43652', m7Downloads: '3829', xsControl: '3829', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'yellow_flix', name: 'Yellow Flix', link: 'https://tinyurl.com/yellowflix', downloader: '3477105', ntdown: '18654', m7Downloads: '5165', xsControl: '5165', adultPassword: '9999', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'yellow_xc', name: 'Yellow XC', link: 'https://tinyurl.com/newyellowxc', downloader: '2069005', ntdown: '74599', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'smarters_x', name: 'Smarters X', link: 'https://tinyurl.com/smartersyellowx', downloader: '8959386', ntdown: '62986', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'smarters_lite_ios', name: 'Smarters Player Lite iOS', link: 'https://apps.apple.com/br/app/smarters-player-lite/id1628995509', fields: ['name', 'url', 'username', 'password'], devices: ['ios'], url: 'host do cliente', installHint: 'Nome Yellow; enter_url deve ser o host do cliente.' },
      { key: 'smart_stb', name: 'Smart UP / Smart STB', dns: '209.14.84.25', fields: ['dns', 'username', 'password'], devices: SMART_TV_DNS_DEVICES },
      { key: 'web_player', name: 'Web Player', url: 'http://web.appnovo.top', fields: ['url', 'username', 'password'], devices: ['pc'] },
    ],
  },
  {
    key: 'YELLOW_X3_ANTIGO',
    name: 'Yellow Box X3 / Antigo',
    aliases: ['yellow x3', 'x3', 'x3 antigo', 'x3box', 'yellow antigo'],
    panelUrl: 'https://painelx3.site/#/customers',
    defaultHost: 'http://x3box.top',
    dnsSmartStb: [{ value: '208.122.18.77' }],
    dnsXciptvSmartersNotRecommended: 'http://yellow.adv.br:80',
    webPlayers: ['http://webx.daxy.top/login'],
    m3uOutput: 'mpegts',
    internalNotes: 'DNS XCIPTV/SMARTERS PRO existe, mas nao e recomendado.',
    apps: [
      { key: 'x3_player', name: 'X3 Player', fields: ['username', 'password'], recommended: true, priority: 10 },
      { key: 'rp725', name: 'RP725', code: '12345670', fields: ['code', 'username', 'password'] },
      { key: 'blessed', name: 'Blessed Player', code: '1105', fields: ['code', 'username', 'password'] },
      { key: 'playsim', name: 'Play Sim', code: '187052', fields: ['code', 'username', 'password'] },
      { key: 'assist_plus', name: 'Assisti Plus', code: '187052', fields: ['code', 'username', 'password'] },
      { key: 'noma_app', name: 'Noma App', code: 'x3yellowx3', fields: ['code', 'username', 'password'] },
      { key: 'x3_streambox', name: 'X3 Streambox', link: 'http://aftv.news/2359431', downloader: '2359431', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'x3_ibo_player_pro', name: 'X3 IBO PLAYER PRO', link: 'http://aftv.news/5113168', downloader: '5113168', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'x3_vu_player_pro', name: 'X3 VU PLAYER PRO', link: 'http://aftv.news/1638198', downloader: '1638198', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'x3_ibo4k_plus_max', name: 'X3 IBO4K Plus Max', link: 'http://aftv.news/3277952', downloader: '3277952', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'x3_unitv_2', name: 'X3 UNITV 2', link: 'http://aftv.news/1736772', downloader: '1736772', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'windows', name: 'Windows', link: 'https://www.mediafire.com/file/xvewjntwrdkh55q/X3WINIPTV.exe/file', fields: ['username', 'password'], devices: ['windows', 'pc'] },
      { key: 'smart_stb', name: 'Smart TV antiga', dns: '208.122.18.77', fields: ['dns', 'username', 'password'], devices: SMART_TV_DNS_DEVICES },
      { key: 'web_player', name: 'Web Player', url: 'http://webx.daxy.top/login', fields: ['url', 'username', 'password'], devices: ['pc'] },
    ],
  },
  {
    key: 'CINEMAX',
    name: 'CineMax',
    aliases: ['cinemax', 'cine max'],
    panelUrl: 'https://cinemax.top/#/customers',
    defaultHost: 'http://dnsmax.top',
    dnsXciptv: 'http://cinesmarters.top',
    dnsSmarters: 'http://cinesmarters.top',
    dnsSmartStb: [
      { value: '178.156.160.255', label: 'Versao Netflix' },
      { value: '5.161.217.130', label: 'V3' },
      { value: '216.106.182.49' },
      { value: '178.156.146.66' },
    ],
    webPlayers: ['http://appcinemax.top/web', 'http://cinemax.daxy.top/login', 'http://webcinemax.top'],
    m3uOutput: 'mpegts',
    apps: [
      { key: 'assist_plus', name: 'Assist Plus', code: '060214', fields: ['code', 'username', 'password'], devices: ALL_TV_DEVICES },
      { key: 'playsim', name: 'Play Sim', code: '060214', fields: ['code', 'username', 'password'], devices: ALL_TV_DEVICES },
      { key: 'focox_play', name: 'Focox Play', code: '968p4k6g', fields: ['code', 'username', 'password'], devices: ALL_TV_DEVICES },
      { key: 'fun_player', name: 'Fun Player', code: '968p4k6g', fields: ['code', 'username', 'password'], devices: ALL_TV_DEVICES, recommended: true, priority: 10 },
      { key: '9xtream_4k', name: '9Xtream 4K IPTV', link: 'http://aftv.news/1728201', downloader: '1728201', fields: ['username', 'password'], installHint: 'Tutorial: https://www.youtube.com/watch?v=Vnba2jYFaWA | Gerenciar: https://9xtream4k.com/manage/playlists/' },
      { key: 'fenix_tivimate', name: 'FENIX PLAY - TIVIMATE', downloader: '2625911', ntdown: '68139', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES, installHint: 'Selecionar servidor 04.' },
      { key: 'xc_max', name: 'XC MAX', link: 'https://fui.ai/xcmax', downloader: '9980196', ntdown: '99842', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES, installHint: 'Selecionar servidor 04.' },
      { key: 'cinemax_9xtream', name: 'CINEMAX - 9XTREAM', link: 'http://aftv.news/2609411', downloader: '3676026', ntdown: '14612', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES, installHint: 'Selecionar servidor 04.' },
      { key: 'cinemax_onestream', name: 'CINEMAX - ONESTREAM', link: 'http://aftv.news/1947616', downloader: '1947616', ntdown: '46882', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'cinemax_ibo4k_plus', name: 'CINEMAX - IBO 4K PLUS', link: 'https://fui.ai/cinemax4k', downloader: '9277401', ntdown: '31428', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'cinemax_sm', name: 'CINEMAX - SM', link: 'http://aftv.news/5865630', downloader: '5865630', ntdown: '18111', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'cinemax_v3', name: 'CINEMAX - V3', link: 'http://fui.ai/cinemaxv3', downloader: '4524678', ntdown: '57886', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'cinemax_v4', name: 'CINEMAX - V4', link: 'https://fui.ai/cinemaxv4', downloader: '2585953', ntdown: '13219', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'launcher_mxq', name: 'Launcher MXQ', link: 'http://aftv.news/2844826', downloader: '2844826', ntdown: '93663', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: '9xtream_ios', name: '9Xtream 4K IPTV iPhone', link: 'https://apps.apple.com/us/app/9xtream-4k-player-iptv-live/id6745410384', fields: ['username', 'password'], devices: ['ios'] },
      { key: 'cinemax_windows', name: 'CineMax Player Windows', link: 'https://www.mediafire.com/file/67pi6dzco1appv0/CINEMAX_PLAYER.exe/file', fields: ['username', 'password'], devices: ['windows', 'pc'] },
      { key: '9xtream_windows', name: '9Xtream Windows', link: 'https://apps.microsoft.com/detail/9nhmwqsp9pj7?hl=pt-BR&gl=BR', fields: ['username', 'password'], devices: ['windows', 'pc'] },
      { key: 'smart_stb', name: 'Smart UP / Smart STB', dns: '5.161.217.130', fields: ['dns', 'username', 'password'], devices: SMART_TV_DNS_DEVICES },
      { key: 'smartone', name: 'SmartOne', url: 'https://smartone-iptv.com/', fields: ['url'], devices: ['smart_tv_antiga'], installHint: 'Tutorial: https://www.youtube.com/watch?v=fQnzN7C0TwA | Licenca: https://ativadortop.com/ | IP: 5.78.42.49' },
      { key: 'clouddy', name: 'Clouddy', url: 'https://clouddy.online/', fields: ['url'], devices: ['smart_tv_antiga'], installHint: 'Tutorial: https://www.youtube.com/watch?v=e83E91MlsHM | IP: 46.165.236.165' },
      { key: 'set_iptv', name: 'Set IPTV', url: 'https://cms.manage-setiptv.com/set.app', fields: ['url'], devices: ['smart_tv_antiga'], installHint: 'Tutorial: https://www.youtube.com/watch?v=UqP7HJUBqNY | IP: 94.23.97.11' },
      { key: 'bay_iptv', name: 'Bay IPTV', url: 'https://cms.bayip.tv/user/manage/playlist', fields: ['url'], devices: ['smart_tv_antiga'], installHint: 'Tutorial: https://www.youtube.com/watch?v=Bg9ZSzZPKEo' },
      { key: 'ssiptv', name: 'SSIPTV', url: 'https://ss-iptv.com/en/users/playlist', fields: ['url'], devices: ['smart_tv_antiga'], installHint: 'Tutorial: https://www.youtube.com/watch?v=yuZwkY9IF3k | IP: 91.122.100.196' },
    ],
  },
  {
    key: 'NINETY',
    name: 'Ninety',
    aliases: ['ninety', 'noventa', '90', 'xbr ninety'],
    panelUrl: 'https://fujian.dad/#/customers',
    defaultHost: 'http://topkox.click',
    dnsSmartStb: [
      { value: '198.50.224.145', label: 'V3' },
      { value: '167.114.4.164', label: 'Netflix' },
    ],
    webPlayers: ['https://noventa90.online'],
    m3uOutput: 'mpegts',
    internalNotes: 'Se o cliente foi gerado pelo Ninety, app mais seguro/recomendado e Lotus codigo 22.',
    apps: [
      { key: 'lotus', name: 'Lotus', code: '22', fields: ['code', 'username', 'password'], adultPassword: '0000', recommended: true, priority: 10, installHint: 'App recomendado para Ninety: Lotus codigo 22.' },
      { key: 'utmpro', name: 'UTMPRO', code: '2017', fields: ['code', 'username', 'password'], adultPassword: '0000' },
      { key: 'new_ninety', name: 'New Ninety', link: 'https://rma.la/newninety', downloader: '5069813', ntdown: '13363', m7Downloads: '1336', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'ninety_ibo', name: 'Ninety IBO', link: 'https://rma.la/ninety4k', downloader: '652046', ntdown: '17826', m7Downloads: '6520', adultPassword: '0000', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'ninety_mega', name: 'Ninety Mega', link: 'https://rma.la/ninetymega', downloader: '254560', ntdown: '41184', m7Downloads: '6492', adultPassword: '0000', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'fantasma_iptv', name: 'Fantasma IPTV', link: 'https://rma.la/fantasmaiptv', downloader: '6840110', ntdown: '33159', m7Downloads: '3315', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'smart_stb', name: 'SmartUP / STB', dns: '198.50.224.145', fields: ['dns', 'username', 'password'], devices: SMART_TV_DNS_DEVICES },
      { key: 'web_player', name: 'WebPlayer', url: 'https://noventa90.online', fields: ['url', 'username', 'password'], devices: ['pc'] },
    ],
  },
  {
    key: 'XBR_DEVXTOP',
    name: 'XBR / DevXTop',
    aliases: ['xbr', 'devxtop', 'xbr devxtop', 'x br top cine', 'devx top'],
    panelUrl: 'https://devxtop.com/#/customers',
    defaultHost: 'http://devicemini.ink',
    dnsXciptv: 'http://devicemini.ink',
    dnsSmarters: 'http://devicemini.ink',
    dnsSmartStb: [{ value: '198.204.232.122' }],
    webPlayers: ['http://nextlevel.webplayerfull.online'],
    m3uOutput: 'mpegts',
    apps: [
      ...['Assist+', 'PlaySim', 'Lazer Play', 'Fun Play', 'Super Play', 'Box Player', 'Magic Player', 'Fast Player', 'Power Play', 'Vizzion Play', 'Epic Play'].map((name) => ({
        key: slug(name),
        name,
        code: '00112',
        fields: ['code', 'username', 'password'] as CredentialField[],
        recommended: name === 'Fun Play',
      })),
      { key: 'blessed', name: 'Blessed Player', code: 'xbrtc', fields: ['code', 'username', 'password'] },
      { key: 'iptv_smarters_pro', name: 'IPTV Smarters PRO', code: 'XBRTOP', dns: 'http://devicemini.ink', fields: ['name', 'dns', 'username', 'password'] },
      { key: 'sa_player', name: 'S.A Player', code: 'topcine', fields: ['code', 'username', 'password'], installHint: 'Disponivel Play Store / Google TV.' },
      { key: 'sa_power', name: 'S.A Power', fields: ['username', 'password'] },
      { key: 'xciptv', name: 'XCIPTV', dns: 'http://devicemini.ink', fields: ['dns', 'username', 'password'] },
      { key: 'smarters_lite_ios', name: 'Smarters Player Lite iPhone', code: 'XBRTOP', dns: 'http://devicemini.ink', fields: ['name', 'dns', 'username', 'password'], devices: ['ios'] },
      { key: '9xtream', name: '9Xtream', code: 'XBRTOP', dns: 'http://devicemini.ink', fields: ['name', 'dns', 'username', 'password'] },
      { key: 'smart_stb', name: 'Smart UP / STB', dns: '198.204.232.122', fields: ['dns', 'username', 'password'], devices: SMART_TV_DNS_DEVICES },
      { key: 'sa_player_downloader', name: 'S.A Player via Downloader', downloader: '8083076', ntdown: '71895', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'adlmg', name: 'ADLMG via Downloader', downloader: '143037', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'web_player', name: 'Web Player', url: 'http://nextlevel.webplayerfull.online', fields: ['url', 'username', 'password'], devices: ['pc'] },
    ],
  },
  {
    key: 'AREAPLAY_SIGMA',
    name: 'AreaPlay / Sigma',
    aliases: ['areaplay', 'area play', 'sigma', 'areaplay sigma', 'area play sigma'],
    panelUrl: 'https://areaplay.sigma.st/#/customers',
    dnsXciptv: 'http://xenora.foo',
    dnsSmarters: 'http://cdn.donivan.zip',
    dnsSmartStb: [{ value: '45.139.50.97', label: 'V3' }],
    webPlayers: ['http://areawebxxx.top', 'https://gpcpro.com.br/'],
    webPlayerCode: '3010047',
    m3uOutput: 'ts',
    apps: [
      { key: 'xciptv', name: 'XCIPTV e afins', dns: 'http://xenora.foo', fields: ['dns', 'username', 'password'], recommended: true },
      { key: 'smarters', name: 'IPTV Smarters e afins', dns: 'http://cdn.donivan.zip', fields: ['name', 'dns', 'username', 'password'] },
      { key: 'smart_stb', name: 'SmartUp / STB', dns: '45.139.50.97', fields: ['dns', 'username', 'password'], devices: SMART_TV_DNS_DEVICES },
      { key: 'web_player_netflix_1', name: 'WEB PLAYER NETFLIX 1', url: 'http://areawebxxx.top', fields: ['url', 'username', 'password'], devices: ['pc'] },
      { key: 'web_player_2', name: 'WEB PLAYER 2', url: 'https://gpcpro.com.br/', code: '3010047', fields: ['url', 'code', 'username', 'password'], devices: ['pc'] },
      { key: 'iboarea', name: 'APP IBOAREA', link: 'https://web.ntdown.me/areaplay', ntdown: '68558', downloader: '2034689', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
      { key: 'unitv_areaplay', name: 'APP UNITV/AREAPLAY', link: 'https://web.ntdown.me/areaplay', ntdown: '22893', downloader: '8217735', fields: ['username', 'password'], devices: ANDROID_BOX_DEVICES },
    ],
  },
]

function slug(value: string): string {
  return normalizeCatalogText(value).replace(/\s+/g, '_')
}

function normalizeCatalogText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function encodePart(value: string): string {
  return encodeURIComponent(value)
}

export function listProviders(): ProviderCatalogEntry[] {
  return PROVIDER_CATALOG
}

export function findProvider(provider: ProviderKey | string): ProviderCatalogEntry | undefined {
  const normalized = normalizeCatalogText(provider)
  return PROVIDER_CATALOG.find((entry) =>
    normalizeCatalogText(entry.key) === normalized ||
    normalizeCatalogText(entry.name) === normalized ||
    entry.aliases.some((alias) => normalizeCatalogText(alias) === normalized)
  )
}

export function getProviderPanelUrl(provider: ProviderKey | string): string | undefined {
  return findProvider(provider)?.panelUrl
}

export function getProviderSmartTvDns(provider: ProviderKey | string): DnsOption[] {
  return findProvider(provider)?.dnsSmartStb || []
}

export function getProviderWebPlayers(provider: ProviderKey | string): string[] {
  return findProvider(provider)?.webPlayers || []
}

export function listCompatibleApps(provider: ProviderKey | string, device?: DeviceKey): ProviderApp[] {
  const entry = findProvider(provider)
  if (!entry) return []
  return entry.apps
    .filter((app) => !device || !app.devices || app.devices.includes(device))
    .slice()
    .sort((a, b) => Number(Boolean(b.recommended)) - Number(Boolean(a.recommended)) || (a.priority || 999) - (b.priority || 999) || a.name.localeCompare(b.name))
}

export function findProviderApp(provider: ProviderKey | string, appValue?: string): ProviderApp | undefined {
  const entry = findProvider(provider)
  if (!entry) return undefined
  const normalized = normalizeCatalogText(appValue || '')
  if (!normalized) return listCompatibleApps(entry.key)[0]
  return entry.apps.find((app) =>
    normalizeCatalogText(app.key) === normalized ||
    normalizeCatalogText(app.name) === normalized ||
    (app.aliases || []).some((alias) => normalizeCatalogText(alias) === normalized)
  )
}

export function buildM3uUrl(host: string, username: string, password: string, output: 'mpegts' | 'ts' = 'mpegts'): string {
  return `${trimSlash(host)}/get.php?username=${encodePart(username)}&password=${encodePart(password)}&type=m3u_plus&output=${output}`
}

export function buildHlsUrl(host: string, username: string, password: string): string {
  return `${trimSlash(host)}/get.php?username=${encodePart(username)}&password=${encodePart(password)}&type=m3u_plus&output=hls`
}

export function buildSsiptvUrl(host: string, username: string, password: string, provider?: ProviderCatalogEntry): string {
  const base = provider?.ssiptvBaseUrl || host
  return `${trimSlash(base)}/get.php?username=${encodePart(username)}&password=${encodePart(password)}&type=ssiptv`
}

export function buildProviderCredentials(input: CredentialInput): BuiltCredentials {
  const provider = findProvider(input.provider)
  if (!provider) {
    throw new Error(`Provider not found: ${String(input.provider)}`)
  }
  const app = findProviderApp(provider.key, input.app) || listCompatibleApps(provider.key)[0]
  if (!app) {
    throw new Error(`No app configured for provider: ${provider.key}`)
  }

  const username = input.username || ''
  const password = input.password || ''
  const host = input.host || provider.defaultHost || app.url || ''
  const canBuildXtream = Boolean(host && username && password)
  const dns = app.dns || provider.dnsXciptv || provider.dnsSmarters || provider.dnsSmartStb?.[0]?.value

  return {
    providerKey: provider.key,
    providerName: provider.name,
    app: app.name,
    appKey: app.key,
    panelUrl: provider.panelUrl,
    providerCode: app.providerCode,
    code: app.code,
    username: username || undefined,
    password: password || undefined,
    host: host || undefined,
    dns,
    smartStbDns: provider.dnsSmartStb || [],
    webPlayers: provider.webPlayers || [],
    m3uUrl: canBuildXtream ? buildM3uUrl(host, username, password, provider.m3uOutput || 'mpegts') : undefined,
    hlsUrl: canBuildXtream ? buildHlsUrl(host, username, password) : undefined,
    ssiptvUrl: canBuildXtream ? buildSsiptvUrl(host, username, password, provider) : undefined,
    link: app.link,
    downloader: app.downloader,
    ntdown: app.ntdown,
    m7Downloads: app.m7Downloads,
    xsControl: app.xsControl,
    adultPassword: app.adultPassword,
    fields: app.fields,
    installHint: app.installHint || buildInstallHint(provider, app),
  }
}

function buildInstallHint(provider: ProviderCatalogEntry, app: ProviderApp): string {
  const code = app.providerCode || app.code
  const codeText = code ? ` Codigo/provider: ${code}.` : ''
  const dnsText = app.dns || provider.dnsXciptv || provider.dnsSmarters ? ` DNS: ${app.dns || provider.dnsXciptv || provider.dnsSmarters}.` : ''
  const downloadText = app.downloader ? ` Downloader: ${app.downloader}.` : ''
  return `${provider.name} + ${app.name}.${codeText}${dnsText}${downloadText}`.trim()
}
