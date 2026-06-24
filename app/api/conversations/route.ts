import { NextRequest, NextResponse } from 'next/server'
import {
  listConversations,
  createConversation,
  deleteConversation,
  updateConversation,
} from '@/lib/conversations'
import type { ModelId } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const conversations = listConversations()
  return NextResponse.json({ conversations })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { model?: ModelId; useCase?: string; title?: string }
  const conv = createConversation({
    model: body.model || 'gpt4',
    useCase: body.useCase || 'allgemein',
    title: body.title,
  })
  return NextResponse.json({ conversation: conv })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    id: string
    title?: string
    model?: ModelId
    useCase?: string
  }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  updateConversation(body.id, {
    title: body.title,
    model: body.model,
    useCase: body.useCase,
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  deleteConversation(id)
  return NextResponse.json({ ok: true })
}
