import { NextResponse } from 'next/server'
import { getTestsData } from '@/lib/queries/tests'

export async function GET() {
  const data = await getTestsData()
  return NextResponse.json(data)
}
