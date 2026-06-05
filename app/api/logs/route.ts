import { NextResponse } from 'next/server'
import { getLogsData } from '@/lib/queries/logs'

export async function GET() {
  const data = await getLogsData()
  return NextResponse.json(data)
}
