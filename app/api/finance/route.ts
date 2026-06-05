import { NextResponse } from 'next/server'
import { getFinanceData } from '@/lib/queries/finance'

export async function GET() {
  const data = await getFinanceData()
  return NextResponse.json(data)
}
