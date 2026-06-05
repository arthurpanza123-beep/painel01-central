import { NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/queries/dashboard'

export async function GET() {
  const metrics = await getDashboardData()
  return NextResponse.json(metrics)
}
