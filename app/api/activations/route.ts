import { NextRequest, NextResponse } from 'next/server'

import { activatePaidClient, activationErrorResponse } from '@/lib/services/activations/paid-activation'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await activatePaidClient(body)
    return NextResponse.json(result)
  } catch (error) {
    const response = activationErrorResponse(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
