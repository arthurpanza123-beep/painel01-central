import { NextResponse } from 'next/server'
import { getAccountsData } from '@/lib/queries/accounts'

export async function GET() {
  const data = await getAccountsData()
  return NextResponse.json(data)
}
