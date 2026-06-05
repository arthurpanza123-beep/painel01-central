export const loginEmailSelectors = [
  'input[type="email"]',
  'input[name="email"]',
  'input[name="username"]',
  'input[placeholder*="email" i]',
  'input[placeholder*="usuario" i]',
  'input[placeholder*="user" i]',
]

export const loginPasswordSelectors = [
  'input[type="password"]',
  'input[name="password"]',
  'input[placeholder*="senha" i]',
  'input[placeholder*="password" i]',
]

export const deviceKeySelectors = [
  process.env.XCLOUD_DEVICE_KEY_SELECTOR || '',
  'input[name*="device" i]',
  'input[name*="key" i]',
  'input[placeholder*="device" i]',
  'input[placeholder*="key" i]',
  'input[placeholder*="chave" i]',
].filter(Boolean)

export const hostSelectors = [
  'input[name*="host" i]',
  'input[name*="dns" i]',
  'input[placeholder*="host" i]',
  'input[placeholder*="dns" i]',
  'input[placeholder*="server" i]',
]

export const usernameSelectors = [
  'input[name*="username" i]',
  'input[name*="user" i]',
  'input[name*="login" i]',
  'input[placeholder*="username" i]',
  'input[placeholder*="usuario" i]',
  'input[placeholder*="usuário" i]',
  'input[placeholder*="login" i]',
]

export const xtreamPasswordSelectors = [
  'input[name*="password" i]',
  'input[name*="pass" i]',
  'input[placeholder*="password" i]',
  'input[placeholder*="senha" i]',
]
