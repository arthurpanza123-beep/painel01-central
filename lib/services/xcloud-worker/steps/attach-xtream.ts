import type { Locator, Page } from 'playwright'

import { hostSelectors, usernameSelectors, xtreamPasswordSelectors } from '../selectors'
import type { XcloudWorkerConfig } from '../types'

async function fillFirst(page: Page | Locator, selectors: string[], value: string): Promise<boolean> {
  for (const selector of selectors) {
    const field = page.locator(selector).first()
    if (await field.isVisible({ timeout: 1500 }).catch(() => false)) {
      await field.fill(value)
      return true
    }
  }
  return false
}

async function clickByText(page: Page | Locator, labels: RegExp[], timeout = 1800): Promise<boolean> {
  for (const label of labels) {
    const button = page.getByRole('button', { name: label }).first()
    if (await button.isVisible({ timeout }).catch(() => false)) {
      await button.click()
      return true
    }
    const text = page.getByText(label).first()
    if (await text.isVisible({ timeout }).catch(() => false)) {
      await text.click()
      return true
    }
  }
  return false
}

function playlistUrl(template: string, deviceKey: string): string {
  if (!template) throw new Error('XCLOUD_CUSTOM_PLAYLIST_URL nao configurada.')
  return template
    .replace(/\{DEVICE_KEY\}/g, encodeURIComponent(deviceKey))
    .replace(/\{device_key\}/g, encodeURIComponent(deviceKey))
}

async function confirmationFound(page: Page): Promise<boolean> {
  const confirmation = page.getByText(/Please reload your APP|playlist successfully attached/i).first()
  if (await confirmation.isVisible({ timeout: 7000 }).catch(() => false)) return true
  const body = await page.locator('body').textContent({ timeout: 2000 }).catch(() => '')
  return /Please reload your APP|playlist successfully attached/i.test(body || '')
}

export async function attachXtreamCredentials(page: Page, config: XcloudWorkerConfig, input: {
  deviceKey: string
  host: string
  username: string
  password: string
}): Promise<{ xtream_attached: boolean; confirmation_found: boolean }> {
  await page.goto(playlistUrl(config.customPlaylistUrl, input.deviceKey), { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: config.pageTimeoutMs }).catch(() => null)

  await clickByText(page, [/xtream\s*credentials/i, /xtream/i]).catch(() => false)
  await page.waitForTimeout(500)

  const hostFilled = await fillFirst(page, hostSelectors, input.host)
  const userFilled = await fillFirst(page, usernameSelectors, input.username)
  const passwordFilled = await fillFirst(page, xtreamPasswordSelectors, input.password)
  if (!hostFilled || !userFilled || !passwordFilled) {
    throw new Error('Campos Xtream Host/Username/Password nao encontrados.')
  }

  const saved = await clickByText(page, [/^save$/i, /salvar/i, /attach/i, /vincular/i])
  if (!saved) throw new Error('Botao Save da playlist Xtream nao encontrado.')
  await page.waitForLoadState('networkidle', { timeout: config.pageTimeoutMs }).catch(() => null)

  const found = await confirmationFound(page)
  if (!found) throw new Error('Confirmacao XCloud nao encontrada apos salvar Xtream.')
  return { xtream_attached: true, confirmation_found: true }
}
