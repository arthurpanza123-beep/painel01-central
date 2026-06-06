import { NextRequest, NextResponse } from 'next/server'

import { getClientAssistantContext, updateClientAssistantMemory } from '@/lib/services/client-assistant'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const state = await getClientAssistantContext(id)
    return NextResponse.json({ ok: true, memory: state.memory, context: state.context, execution: state.execution })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao carregar memoria.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await req.json().catch(() => ({}))
    const result = await updateClientAssistantMemory(id, body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao salvar memoria.' }, { status: 500 })
  }
}
