import { NextRequest, NextResponse } from 'next/server'
import { renewClient, renewalErrorResponse } from '@/lib/services/renewals/renew-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await renewClient(body)
    return NextResponse.json(result)
  } catch (error) {
    const response = renewalErrorResponse(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
