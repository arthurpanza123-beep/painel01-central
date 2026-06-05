import type { Locator, Page } from 'playwright'

import type { XcloudWorkerConfig } from '../types'
import { deviceExists, loginIfNeeded, openDevices } from './add-device'

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

async function findDeviceRow(page: Page, deviceKey: string): Promise<Locator | null> {
  await page.waitForTimeout(700)
  const rows = await page.locator('tr, [role="row"]').all()
  for (const row of rows) {
    const text = await row.textContent().catch(() => '')
    if ((text || '').includes(deviceKey)) return row
  }
  const keyed = page.getByText(deviceKey, { exact: false }).first()
  if (!await keyed.isVisible({ timeout: 1500 }).catch(() => false)) return null
  return keyed.locator('xpath=ancestor::*[self::tr or @role="row" or contains(@class,"row")][1]')
}

async function openRowMenu(row: Locator): Promise<void> {
  const menuButtons = [
    'button[aria-haspopup="menu"]',
    'button[aria-expanded]',
    'button:has-text("...")',
    'button:has-text("⋯")',
    'button:has-text("More")',
  ]
  for (const selector of menuButtons) {
    const button = row.locator(selector).last()
    if (await button.isVisible({ timeout: 900 }).catch(() => false)) {
      await button.click()
      return
    }
  }
  const buttons = await row.locator('button').all()
  if (buttons.length > 0) {
    await buttons[buttons.length - 1].click()
    return
  }
  throw new Error('Menu de acoes da device nao encontrado.')
}

async function confirmAction(page: Page, labels: RegExp[]): Promise<void> {
  const dialog = page.locator('[role="dialog"], .modal, .drawer').first()
  const root = await dialog.isVisible({ timeout: 1500 }).catch(() => false) ? dialog : page
  const confirmed = await clickByText(root, labels, 2500)
  if (!confirmed) throw new Error('Confirmacao da acao XCloud nao encontrada.')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)
  await page.waitForTimeout(700)
}

export async function findXcloudDevice(page: Page, config: XcloudWorkerConfig, deviceKey: string): Promise<{ device_found: boolean }> {
  await loginIfNeeded(page, config)
  await openDevices(page, config)
  return { device_found: Boolean(await findDeviceRow(page, deviceKey)) }
}

export async function deactivateXcloudDevice(page: Page, config: XcloudWorkerConfig, deviceKey: string): Promise<{ device_deactivated: boolean }> {
  await loginIfNeeded(page, config)
  await openDevices(page, config)
  const row = await findDeviceRow(page, deviceKey)
  if (!row) throw new Error('Device XCloud nao encontrada para desativar.')
  await openRowMenu(row)
  const clicked = await clickByText(page, [/deactivate/i, /desativar/i])
  if (!clicked) throw new Error('Acao Deactivate da device nao encontrada.')
  await confirmAction(page, [/^deactivate$/i, /confirm/i, /confirmar/i, /desativar/i])

  return { device_deactivated: true }
}

export async function deleteXcloudDevice(page: Page, config: XcloudWorkerConfig, deviceKey: string): Promise<{ device_deleted: boolean }> {
  await loginIfNeeded(page, config)
  await openDevices(page, config)
  const row = await findDeviceRow(page, deviceKey)
  if (!row) throw new Error('Device XCloud nao encontrada para excluir.')
  await openRowMenu(row)
  const clicked = await clickByText(page, [/^delete$/i, /excluir/i, /remover/i])
  if (!clicked) throw new Error('Acao Delete da device nao encontrada.')
  await confirmAction(page, [/^delete$/i, /confirm/i, /confirmar/i, /excluir/i, /remover/i])
  await page.waitForTimeout(1200)
  return { device_deleted: !await deviceExists(page, deviceKey) }
}
