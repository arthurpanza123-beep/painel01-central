import { NextResponse } from 'next/server'
import { getRenewalsData } from '@/lib/queries/renewals'

export async function GET() {
  const data = await getRenewalsData()
  return NextResponse.json(data)
}
