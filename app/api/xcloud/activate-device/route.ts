import { NextRequest, NextResponse } from 'next/server'

import { runXcloudWorker, xcloudWorkerErrorResponse } from '@/lib/services/xcloud-worker'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await runXcloudWorker(body)
    return NextResponse.json({ success: result.status !== 'failed', ...result }, { status: result.status === 'failed' ? 500 : 200 })
  } catch (error) {
    const response = xcloudWorkerErrorResponse(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
