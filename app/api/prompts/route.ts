import { NextResponse } from 'next/server'
import { getUseCases } from '@/lib/prompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ useCases: getUseCases() })
}
