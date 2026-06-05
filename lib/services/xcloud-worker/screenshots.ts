import fs from 'node:fs'
import path from 'node:path'

import type { Page } from 'playwright'

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'xcloud'
}

export async function saveXcloudScreenshot(page: Page | null, screenshotsDir: string, label: string): Promise<string | null> {
  if (!page) return null
  fs.mkdirSync(screenshotsDir, { recursive: true })
  const file = path.join(screenshotsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeName(label)}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}
