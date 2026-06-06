import { NextRequest, NextResponse } from 'next/server'
import { getTestsData } from '@/lib/queries/tests'

export async function GET(req: NextRequest) {
  const data = await getTestsData({
    testId: req.nextUrl.searchParams.get('test_id'),
    clientId: req.nextUrl.searchParams.get('client_id'),
  })
  return NextResponse.json(data)
}
