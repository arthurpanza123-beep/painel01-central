import { NextRequest, NextResponse } from 'next/server'
import { getClientsData } from '@/lib/queries/clients'

export async function GET(req: NextRequest) {
  const context = req.nextUrl.searchParams.get('context')
  const data = await getClientsData({
    context: context === 'activation' ? 'activation' : 'default',
    search: req.nextUrl.searchParams.get('q') || undefined,
  })
  return NextResponse.json(data)
}
