import type { Locator, Page } from 'playwright'

import { deviceKeySelectors, loginEmailSelectors, loginPasswordSelectors } from '../selectors'
import type { XcloudDeviceReadiness, XcloudWorkerConfig } from '../types'

type AddXcloudDeviceResult = {
  device_added: boolean
  already_exists: boolean
  ready_for_xtream: boolean
  readiness?: XcloudDeviceReadiness
}

type DeviceRowSnapshot = {
  locator: Locator
  text: string
  cells: string[]
  attributes: string
}

async function firstVisible(page: Page | Locator, selectors: string[], timeout = 1200): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first()
    if (await locator.isVisible({ timeout }).catch(() => false)) return locator
  }
  return null
}

async function clickByText(page: Page | Locator, labels: RegExp[], timeout = 1500): Promise<boolean> {
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

async function fillFirst(page: Page | Locator, selectors: string[], value: string): Promise<boolean> {
  const field = await firstVisible(page, selectors)
  if (!field) return false
  await field.fill(value)
  return true
}

async function selectOptionByText(page: Page | Locator, labels: RegExp[]): Promise<boolean> {
  const selects = await page.locator('select').all()
  for (const select of selects) {
    const options = await select.locator('option').allTextContents().catch(() => [])
    const index = options.findIndex((text) => labels.some((label) => label.test(text)))
    if (index >= 0) {
      const value = await select.locator('option').nth(index).getAttribute('value')
      if (value !== null) {
        await select.selectOption(value)
        return true
      }
    }
  }
  return false
}

async function markCheckboxByLabel(page: Page | Locator, labels: RegExp[]): Promise<boolean> {
  for (const label of labels) {
    const byLabel = page.getByLabel(label).first()
    if (await byLabel.isVisible({ timeout: 1200 }).catch(() => false)) {
      await byLabel.check().catch(async () => byLabel.click())
      return true
    }
  }
  const checkboxes = await page.locator('input[type="checkbox"]').all()
  for (const checkbox of checkboxes) {
    const nearby = await checkbox.locator('xpath=ancestor::*[self::label or self::div or self::tr][1]').textContent().catch(() => '')
    if (labels.some((label) => label.test(nearby || ''))) {
      await checkbox.check().catch(async () => checkbox.click())
      return true
    }
  }
  return false
}

export async function loginIfNeeded(page: Page, config: XcloudWorkerConfig): Promise<void> {
  await page.goto(config.panelUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: config.pageTimeoutMs }).catch(() => null)

  const hasPassword = await page.locator('input[type="password"]').first().isVisible({ timeout: 2500 }).catch(() => false)
  if (!hasPassword) return

  if (!config.email || !config.password) throw new Error('Credenciais XCloud nao configuradas.')
  const emailFilled = await fillFirst(page, loginEmailSelectors, config.email)
  const passwordFilled = await fillFirst(page, loginPasswordSelectors, config.password)
  if (!emailFilled || !passwordFilled) throw new Error('Formulario de login XCloud nao encontrado.')
  const clicked = await clickByText(page, [/entrar/i, /login/i, /sign\s*in/i, /acessar/i])
  if (!clicked) await page.keyboard.press('Enter')
  await page.waitForLoadState('networkidle', { timeout: config.pageTimeoutMs }).catch(() => null)

  const loginCompleted = await page.waitForFunction(() => {
    const password = document.querySelector('input[type="password"]')
    if (!password) return true
    const body = document.body?.innerText || ''
    return /devices|dispositivos|dashboard|logout|sair/i.test(body)
  }, null, { timeout: config.pageTimeoutMs }).then(() => true).catch(() => false)

  if (!loginCompleted && await page.locator('input[type="password"]').first().isVisible({ timeout: 2500 }).catch(() => false)) {
    throw new Error('Login XCloud nao foi concluido.')
  }
}

export async function openDevices(page: Page, config: XcloudWorkerConfig): Promise<void> {
  if (config.devicesUrl) {
    await page.goto(config.devicesUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: config.pageTimeoutMs }).catch(() => null)
    return
  }
  const clicked = await clickByText(page, [/devices/i, /dispositivos/i])
  if (!clicked) throw new Error('URL de Devices nao configurada e menu Devices nao encontrado.')
  await page.waitForLoadState('networkidle', { timeout: config.pageTimeoutMs }).catch(() => null)
}

export async function deviceExists(page: Page, deviceKey: string): Promise<boolean> {
  await page.waitForTimeout(700)
  return page.getByText(deviceKey, { exact: false }).first().isVisible({ timeout: 2500 }).catch(() => false)
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

async function snapshotDeviceRow(row: Locator): Promise<DeviceRowSnapshot> {
  const text = normalizeText(await row.textContent().catch(() => '') || '')
  const cells = (await row.locator('td, [role="cell"]').allTextContents().catch(() => []))
    .map((cell) => normalizeText(cell))
    .filter(Boolean)
  const attributes = normalizeText(await row.evaluate((element) => {
    const pieces: string[] = []
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT)
    let current = walker.currentNode as Element | null
    while (current) {
      for (const name of ['aria-label', 'title', 'data-state', 'data-status', 'data-checked', 'checked']) {
        const value = current.getAttribute(name)
        if (value) pieces.push(value)
      }
      current = walker.nextNode() as Element | null
    }
    return pieces.join(' ')
  }).catch(() => ''))
  return { locator: row, text, cells, attributes }
}

async function findDeviceRow(page: Page, deviceKey: string): Promise<DeviceRowSnapshot | null> {
  const rows = await page.locator('tr, [role="row"]').all()
  for (const row of rows) {
    const text = await row.textContent().catch(() => '')
    if ((text || '').includes(deviceKey)) return snapshotDeviceRow(row)
  }
  const keyed = page.getByText(deviceKey, { exact: false }).first()
  if (!await keyed.isVisible({ timeout: 1200 }).catch(() => false)) return null
  const row = keyed.locator('xpath=ancestor::*[self::tr or @role="row" or contains(@class,"row")][1]')
  return snapshotDeviceRow(row)
}

function textAfterDeviceKey(snapshot: DeviceRowSnapshot, deviceKey: string): string {
  const index = snapshot.cells.findIndex((cell) => cell.includes(deviceKey))
  if (index >= 0) return snapshot.cells.slice(index + 1).join(' ')
  return snapshot.text.replace(deviceKey, ' ')
}

function readStatus(snapshot: DeviceRowSnapshot): string {
  const statusCell = snapshot.cells.find((cell) => /\b(active|inactive|disabled|deactivated|ativo|inativo|desativado)\b/i.test(cell))
  const source = statusCell || snapshot.text
  const match = source.match(/\b(active|inactive|disabled|deactivated|ativo|inativo|desativado)\b/i)
  return match?.[1] || ''
}

function readPlaylist(snapshot: DeviceRowSnapshot): string {
  const playlistCell = snapshot.cells.find((cell) => /^(n\/a|na|-|none|null|vazio)$/i.test(cell))
    || snapshot.cells.find((cell) => /https?:\/\/|playlist|m3u/i.test(cell))
    || ''
  return playlistCell
}

function readAppName(snapshot: DeviceRowSnapshot): string {
  const combined = `${snapshot.text} ${snapshot.attributes}`
  const match = combined.match(/\b(xcloudtv|xcloudpro)\b/i)
  return match?.[1] || ''
}

function validateDeviceReadiness(snapshot: DeviceRowSnapshot, deviceKey: string): XcloudDeviceReadiness {
  const combined = `${snapshot.text} ${snapshot.attributes}`
  const rowAfterKey = textAfterDeviceKey(snapshot, deviceKey)
  const statusText = readStatus(snapshot)
  const playlistText = readPlaylist(snapshot)
  const appName = readAppName(snapshot)
  const statusActive = /\b(active|ativo)\b/i.test(statusText) && !/\b(inactive|inativo|disabled|deactivated|desativado)\b/i.test(statusText)
  const playlistEmpty = !/https?:\/\/|m3u|mpegts|hls/i.test(playlistText)
    && (!playlistText || /^(n\/a|na|-|none|null|vazio)$/i.test(playlistText))
  const ownPlaylistConfirmed = /own\s*playlist|uses\s*its\s*own\s*playlist|playlist\s*propr|success|checked|true|✓|check/i.test(rowAfterKey)
    || /own\s*playlist|uses\s*its\s*own\s*playlist|playlist\s*propr|success|checked|true/i.test(combined)

  return {
    row_found: true,
    status_active: statusActive,
    playlist_empty: playlistEmpty,
    own_playlist_confirmed: ownPlaylistConfirmed,
    app_name_confirmed: !appName || /xcloudtv|xcloudpro/i.test(appName),
    status_text: statusText || undefined,
    playlist_text: playlistText || undefined,
    app_name: appName || undefined,
  }
}

async function refreshDeviceList(page: Page, config: XcloudWorkerConfig): Promise<void> {
  await openDevices(page, config)
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null)
  await page.waitForLoadState('networkidle', { timeout: config.pageTimeoutMs }).catch(() => null)
  await page.waitForTimeout(800)
}

export async function waitForDeviceReadyAfterAdd(page: Page, config: XcloudWorkerConfig, deviceKey: string): Promise<XcloudDeviceReadiness> {
  const startedAt = Date.now()
  const timeoutMs = config.pageTimeoutMs
  let lastReadiness: XcloudDeviceReadiness | null = null

  while (Date.now() - startedAt < timeoutMs) {
    await refreshDeviceList(page, config)
    const snapshot = await findDeviceRow(page, deviceKey)
    if (!snapshot) {
      await page.waitForTimeout(1500)
      continue
    }

    const readiness = validateDeviceReadiness(snapshot, deviceKey)
    lastReadiness = readiness
    if (readiness.status_active && readiness.playlist_empty && readiness.own_playlist_confirmed && readiness.app_name_confirmed) {
      return readiness
    }

    if (!readiness.status_active && readiness.status_text) {
      throw new Error('XCLOUD_DEVICE_NOT_READY: status da device nao esta Active.')
    }

    await page.waitForTimeout(2000)
  }

  if (!lastReadiness) {
    throw new Error('DEVICE_NOT_FOUND_AFTER_ADD: device nao apareceu na lista apos salvar.')
  }
  throw new Error('XCLOUD_DEVICE_NOT_READY: device apareceu na lista, mas ainda nao esta pronta para Xtream.')
}

export async function addXcloudDevice(page: Page, config: XcloudWorkerConfig, deviceKey: string): Promise<AddXcloudDeviceResult> {
  await loginIfNeeded(page, config)
  await openDevices(page, config)

  if (await deviceExists(page, deviceKey)) {
    return { device_added: false, already_exists: true, ready_for_xtream: true }
  }

  const opened = await clickByText(page, [/add\s*new\s*device/i, /new\s*device/i, /adicionar/i, /novo\s*dispositivo/i])
  if (!opened) throw new Error('Botao Add New Device nao encontrado.')
  await page.waitForTimeout(500)

  const dialog = page.locator('[role="dialog"], .modal, .drawer, form').filter({ has: page.locator('input') }).first()
  const root = await dialog.isVisible({ timeout: 1500 }).catch(() => false) ? dialog : page

  const filled = await fillFirst(root, deviceKeySelectors, deviceKey)
  if (!filled) throw new Error('Campo device key nao encontrado.')

  await selectOptionByText(root, [/immediate/i, /imediat/i]).catch(() => false)
  await selectOptionByText(root, [/1\s*year/i, /1\s*ano/i, /year/i, /ano/i]).catch(() => false)
  await markCheckboxByLabel(root, [/own\s*playlist/i, /uses\s*its\s*own\s*playlist/i, /playlist\s*propr/i]).catch(() => false)

  const saved = await clickByText(root, [/^add$/i, /^save$/i, /salvar/i, /adicionar/i])
  if (!saved) throw new Error('Botao Add/Save do dispositivo nao encontrado.')
  await page.waitForLoadState('networkidle', { timeout: config.pageTimeoutMs }).catch(() => null)
  await page.waitForTimeout(1000)

  const readiness = await waitForDeviceReadyAfterAdd(page, config, deviceKey)

  return { device_added: true, already_exists: false, ready_for_xtream: true, readiness }
}
