import { NextResponse } from 'next/server'
import { getClientsData } from '@/lib/queries/clients'

export async function GET() {
  const data = await getClientsData()
  return NextResponse.json(data)
}
