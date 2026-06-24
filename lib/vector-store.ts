import { v4 as uuidv4 } from 'uuid'
import { getDb } from './db'
import type { KnowledgeDocument } from './types'

interface ChunkRow {
  id: string
  doc_id: string
  doc_name: string
  text: string
  tfidf_json: string
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2)
}

function buildTfIdf(tokens: string[]): Record<string, number> {
  const freq: Record<string, number> = {}
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1 })
  const max = Math.max(...Object.values(freq), 1)
  const tfidf: Record<string, number> = {}
  Object.keys(freq).forEach(term => { tfidf[term] = freq[term] / max })
  return tfidf
}

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0
  let normA = 0
  let normB = 0
  Object.keys(a).forEach(term => {
    dot += a[term] * (b[term] || 0)
    normA += a[term] * a[term]
  })
  Object.values(b).forEach(val => { normB += val * val })
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function chunkText(text: string, maxChars = 500): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const result: string[] = []
  let current = ''
  sentences.forEach(s => {
    if ((current + ' ' + s).length > maxChars && current.length > 0) {
      result.push(current.trim())
      current = s
    } else {
      current = current ? current + ' ' + s : s
    }
  })
  if (current.trim()) result.push(current.trim())
  return result.filter(c => c.length > 20)
}

export function addDocument(id: string, name: string, content: string): KnowledgeDocument {
  const textChunks = chunkText(content)
  const uploadedAt = new Date().toISOString()
  const db = getDb()

  const doc: KnowledgeDocument = {
    id,
    name,
    content,
    size: content.length,
    uploadedAt: new Date(uploadedAt),
    chunks: textChunks.length,
  }

  db.prepare(
    `INSERT INTO knowledge_documents (id, name, content_pseudonymized, size, chunks, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name, content, content.length, textChunks.length, uploadedAt)

  const insertChunk = db.prepare(
    `INSERT INTO knowledge_chunks (id, doc_id, doc_name, text, tfidf_json) VALUES (?, ?, ?, ?, ?)`
  )

  textChunks.forEach(chunk => {
    const tokens = tokenize(chunk)
    insertChunk.run(uuidv4(), id, name, chunk, JSON.stringify(buildTfIdf(tokens)))
  })

  return doc
}

export function searchKnowledge(
  query: string,
  topK = 3
): Array<{ text: string; docName: string; score: number }> {
  const rows = getDb()
    .prepare('SELECT * FROM knowledge_chunks')
    .all() as ChunkRow[]

  if (rows.length === 0) return []

  const queryVec = buildTfIdf(tokenize(query))

  const scored = rows.map(chunk => ({
    text: chunk.text,
    docName: chunk.doc_name,
    score: cosineSimilarity(queryVec, JSON.parse(chunk.tfidf_json)),
  }))

  return scored
    .filter(r => r.score > 0.01)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

export function getDocuments(): KnowledgeDocument[] {
  const rows = getDb()
    .prepare('SELECT * FROM knowledge_documents ORDER BY uploaded_at DESC')
    .all() as Array<{
      id: string
      name: string
      content_pseudonymized: string
      size: number
      chunks: number
      uploaded_at: string
    }>

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    content: row.content_pseudonymized,
    size: row.size,
    uploadedAt: new Date(row.uploaded_at),
    chunks: row.chunks,
  }))
}

export function removeDocument(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM knowledge_chunks WHERE doc_id = ?').run(id)
  db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(id)
}
