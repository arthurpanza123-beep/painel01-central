import { NextResponse } from 'next/server'
import { getPipelineData } from '@/lib/queries/pipeline'

export async function GET() {
  const data = await getPipelineData()
  return NextResponse.json(data)
}
