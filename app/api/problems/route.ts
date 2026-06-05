import { NextResponse } from 'next/server'
import { getProblemsData } from '@/lib/queries/problems'

export async function GET() {
  const data = await getProblemsData()
  return NextResponse.json(data)
}
