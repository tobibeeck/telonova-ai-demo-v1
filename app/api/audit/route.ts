import { NextRequest, NextResponse } from 'next/server'
import { getAuditLogs, getAuditLogCount } from '@/lib/audit-log'
import { getUseCases } from '@/lib/prompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  return NextResponse.json({
    logs: getAuditLogs(limit, offset),
    total: getAuditLogCount(),
    useCases: getUseCases(),
  })
}
