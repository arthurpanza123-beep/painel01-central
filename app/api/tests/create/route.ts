import { NextRequest, NextResponse } from 'next/server'

import { createGeneratedTest, testCreateErrorResponse } from '@/lib/services/test-generation/create-test'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await createGeneratedTest(body)
    return NextResponse.json(result)
  } catch (error) {
    const response = testCreateErrorResponse(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
