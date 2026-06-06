import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_PAINEL2_URL = 'http://127.0.0.1:3002'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, code: 'INVALID_JSON', message: 'Envie JSON valido.' }, { status: 400 })
  }

  const baseUrl = String(process.env.PAINEL2_INTERNAL_URL || process.env.NEXT_PUBLIC_PAINEL2_URL || DEFAULT_PAINEL2_URL).replace(/\/+$/, '')
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/flows/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      code: 'PAINEL2_DISPATCH_FAILED',
      message: error instanceof Error ? error.message : 'Falha ao conectar no Painel 2.',
    }, { status: 502 })
  }

  const payload = await response.json().catch(() => ({ ok: false, code: 'PAINEL2_INVALID_RESPONSE', message: 'Resposta invalida do Painel 2.' }))
  return NextResponse.json(payload, { status: response.ok ? 200 : response.status })
}
