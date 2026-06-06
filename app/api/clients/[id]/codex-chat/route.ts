import { NextRequest, NextResponse } from 'next/server'

import { runClientAssistantChat } from '@/lib/services/client-assistant'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await req.json().catch(() => null) as { content?: string; message?: string } | null
    const content = String(body?.content || body?.message || '').trim()
    if (!content) return NextResponse.json({ ok: false, error: 'Mensagem vazia.' }, { status: 400 })
    const result = await runClientAssistantChat(id, content)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Falha no assistente.' }, { status: 500 })
  }
}
