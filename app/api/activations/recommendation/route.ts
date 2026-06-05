import { NextRequest, NextResponse } from 'next/server'

import { activationErrorResponse, getActivationRecommendation } from '@/lib/services/activations/paid-activation'

function num(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const result = await getActivationRecommendation({
      client_id: url.searchParams.get('client_id') || undefined,
      test_id: url.searchParams.get('test_id') || undefined,
      app_id: url.searchParams.get('app_id') || undefined,
      app_key: url.searchParams.get('app_key') || undefined,
      panel_id: url.searchParams.get('panel_id') || undefined,
      panel_key: url.searchParams.get('panel_key') || undefined,
      account_id: url.searchParams.get('account_id') || undefined,
      slot_id: url.searchParams.get('slot_id') || undefined,
      slot_number: num(url.searchParams.get('slot_number')),
    })
    return NextResponse.json(result)
  } catch (error) {
    const response = activationErrorResponse(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
