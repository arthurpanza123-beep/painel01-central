import fs from 'node:fs'

import { chromium, type BrowserContext, type Page } from 'playwright'

import type { XcloudWorkerConfig } from './types'

let context: BrowserContext | null = null
let page: Page | null = null
let lock: Promise<void> = Promise.resolve()

export async function runXcloudExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const previous = lock
  let release!: () => void
  lock = new Promise((resolve) => { release = resolve })
  await previous
  try {
    return await fn()
  } finally {
    release()
  }
}

export async function getXcloudPage(config: XcloudWorkerConfig): Promise<Page> {
  if (context && page && !page.isClosed()) return page
  fs.mkdirSync(config.profileDir, { recursive: true })
  context = await chromium.launchPersistentContext(config.profileDir, {
    headless: config.headless,
    slowMo: config.slowMoMs,
    viewport: { width: 1366, height: 768 },
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  page = context.pages()[0] || await context.newPage()
  page.setDefaultTimeout(config.pageTimeoutMs)
  return page
}

export async function closeXcloudBrowser() {
  if (!context) return
  await context.close()
  context = null
  page = null
}
