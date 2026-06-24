import type { KnowledgeDocument } from './types'

interface Chunk {
  docId: string
  docName: string
  text: string
  tfIdf: Record<string, number>
}

const documents: KnowledgeDocument[] = []
const chunks: Chunk[] = []

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

  const doc: KnowledgeDocument = {
    id,
    name,
    content,
    size: content.length,
    uploadedAt: new Date(),
    chunks: textChunks.length,
  }
  documents.push(doc)

  textChunks.forEach(chunk => {
    const tokens = tokenize(chunk)
    chunks.push({ docId: id, docName: name, text: chunk, tfIdf: buildTfIdf(tokens) })
  })

  return doc
}

export function searchKnowledge(query: string, topK = 3): Array<{ text: string; docName: string; score: number }> {
  if (chunks.length === 0) return []
  const queryTokens = tokenize(query)
  const queryVec = buildTfIdf(queryTokens)

  const scored = chunks.map(chunk => ({
    text: chunk.text,
    docName: chunk.docName,
    score: cosineSimilarity(queryVec, chunk.tfIdf),
  }))

  return scored
    .filter(r => r.score > 0.01)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

export function getDocuments(): KnowledgeDocument[] {
  return [...documents]
}

export function removeDocument(id: string): void {
  const idx = documents.findIndex(d => d.id === id)
  if (idx !== -1) documents.splice(idx, 1)
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i].docId === id) chunks.splice(i, 1)
  }
}
