import { NextRequest, NextResponse } from 'next/server'

import { createClientAssistantTask } from '@/lib/services/client-assistant'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await req.json().catch(() => ({}))
    const result = await createClientAssistantTask(id, body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao criar tarefa.' }, { status: 500 })
  }
}
