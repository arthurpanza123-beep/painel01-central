import { NextRequest, NextResponse } from 'next/server'

import { readOperationalSettings, writeOperationalSettings } from '@/lib/services/operational-settings'

export async function GET() {
  const settings = await readOperationalSettings()
  return NextResponse.json({ ok: true, settings })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { game_mode_enabled?: boolean } | null
  if (!body || typeof body.game_mode_enabled !== 'boolean') {
    return NextResponse.json({ ok: false, code: 'INVALID_SETTINGS', message: 'Informe game_mode_enabled boolean.' }, { status: 400 })
  }
  const settings = await writeOperationalSettings({ game_mode_enabled: body.game_mode_enabled })
  return NextResponse.json({ ok: true, settings })
}
