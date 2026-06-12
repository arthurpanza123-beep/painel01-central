import { NextRequest, NextResponse } from 'next/server'

import { listPanelNotifications, markPanelNotificationsRead } from '@/lib/services/notifications'

export async function GET() {
  try {
    const items = await listPanelNotifications()
    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Falha ao carregar notificacoes.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null) as { ids?: string[] } | null
  await markPanelNotificationsRead(Array.isArray(body?.ids) ? body.ids : [])
  return NextResponse.json({ success: true })
}
