import { NextRequest, NextResponse } from 'next/server'
import { addDocument, getDocuments, removeDocument } from '@/lib/vector-store'
import { pseudonymizeText } from '@/lib/pseudo-service'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ documents: getDocuments() })
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  let content: string
  const name = file.name

  try {
    if (name.toLowerCase().endsWith('.pdf')) {
      const buffer = Buffer.from(await file.arrayBuffer())
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      content = data.text
    } else if (name.toLowerCase().endsWith('.docx')) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      content = result.value
    } else {
      content = await file.text()
    }
  } catch {
    return NextResponse.json({ error: 'Datei konnte nicht gelesen werden.' }, { status: 400 })
  }

  if (!content.trim()) {
    return NextResponse.json({ error: 'Kein Text im Dokument gefunden.' }, { status: 400 })
  }

  try {
    const { pseudonymized } = await pseudonymizeText(content, { enabled: true })
    const doc = addDocument(uuidv4(), name, pseudonymized)
    return NextResponse.json({ document: doc })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pseudonymisierung fehlgeschlagen'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  removeDocument(id)
  return NextResponse.json({ ok: true })
}
