import fs from 'node:fs/promises'
import path from 'node:path'

export type OperationalSettings = {
  game_mode_enabled: boolean
  test_duration_minutes: number
  updated_at: string
}

const NORMAL_TEST_DURATION_MINUTES = 75
const GAME_TEST_DURATION_MINUTES = 45
const SETTINGS_PATH = path.join(process.cwd(), 'storage/config/operational-settings.json')

function bool(value: unknown): boolean {
  return value === true || /^(1|true|yes|on)$/i.test(String(value || ''))
}

function sanitize(input: Partial<OperationalSettings> | null | undefined): OperationalSettings {
  const gameMode = bool(input?.game_mode_enabled)
  return {
    game_mode_enabled: gameMode,
    test_duration_minutes: gameMode ? GAME_TEST_DURATION_MINUTES : NORMAL_TEST_DURATION_MINUTES,
    updated_at: typeof input?.updated_at === 'string' && input.updated_at ? input.updated_at : new Date().toISOString(),
  }
}

export async function readOperationalSettings(): Promise<OperationalSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf8')
    return sanitize(JSON.parse(raw) as Partial<OperationalSettings>)
  } catch {
    return sanitize(null)
  }
}

export async function writeOperationalSettings(input: { game_mode_enabled: boolean }): Promise<OperationalSettings> {
  const settings = sanitize({ game_mode_enabled: input.game_mode_enabled, updated_at: new Date().toISOString() })
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true })
  await fs.writeFile(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  return settings
}

export function metadataDurationMinutes(metadata: Record<string, unknown> | null | undefined): number | null {
  const value = metadata?.duration_minutes ?? metadata?.test_duration_minutes
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

export function effectiveTestExpiresAt(input: {
  activated_at?: string | null
  requested_at?: string | null
  created_at?: string | null
  expires_at?: string | null
  legacy_metadata?: Record<string, unknown> | null
}, settings: OperationalSettings): { expiresAt: string; durationMinutes: number; source: 'metadata' | 'current_setting' | 'stored_expires_at' } {
  const base = input.activated_at || input.requested_at || input.created_at || new Date().toISOString()
  const durationMinutes = settings.game_mode_enabled ? GAME_TEST_DURATION_MINUTES : NORMAL_TEST_DURATION_MINUTES
  return {
    expiresAt: new Date(new Date(base).getTime() + durationMinutes * 60 * 1000).toISOString(),
    durationMinutes,
    source: 'current_setting',
  }
}
