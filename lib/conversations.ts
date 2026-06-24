import { v4 as uuidv4 } from 'uuid'
import { getDb } from './db'
import type { Conversation, Message, ModelId, PseudoReplacement } from './types'
import type { UseCaseId } from './prompts'

interface ConversationRow {
  id: string
  title: string
  model: ModelId
  use_case: string
  created_at: string
}

interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content_original: string
  content_sent: string
  content_display: string
  replacements_json: string | null
  model: string | null
  created_at: string
}

function rowToMessage(row: MessageRow): Message {
  const replacements: PseudoReplacement[] = row.replacements_json
    ? JSON.parse(row.replacements_json)
    : []
  return {
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content_display,
    contentOriginal: row.content_original,
    contentSent: row.content_sent,
    replacements,
    model: (row.model as ModelId) || undefined,
    timestamp: new Date(row.created_at),
    pseudonymized: replacements.length > 0,
    replacementsCount: replacements.length,
  }
}

export function listConversations(): Conversation[] {
  const db = getDb()
  const convRows = db
    .prepare('SELECT * FROM conversations ORDER BY created_at DESC')
    .all() as ConversationRow[]

  const msgStmt = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  )

  return convRows.map(conv => ({
    id: conv.id,
    title: conv.title,
    model: conv.model,
    useCase: conv.use_case as UseCaseId,
    createdAt: new Date(conv.created_at),
    messages: (msgStmt.all(conv.id) as MessageRow[]).map(rowToMessage),
  }))
}

export function getConversation(id: string): Conversation | null {
  const db = getDb()
  const conv = db
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(id) as ConversationRow | undefined
  if (!conv) return null

  const messages = db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(id) as MessageRow[]

  return {
    id: conv.id,
    title: conv.title,
    model: conv.model,
    useCase: conv.use_case as UseCaseId,
    createdAt: new Date(conv.created_at),
    messages: messages.map(rowToMessage),
  }
}

export function createConversation(params: {
  title?: string
  model: ModelId
  useCase?: string
}): Conversation {
  const id = uuidv4()
  const now = new Date().toISOString()
  const title = params.title || 'Neues Gespräch'

  getDb()
    .prepare(
      'INSERT INTO conversations (id, title, model, use_case, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(id, title, params.model, params.useCase || 'allgemein', now)

  return {
    id,
    title,
    model: params.model,
    useCase: (params.useCase || 'allgemein') as UseCaseId,
    createdAt: new Date(now),
    messages: [],
  }
}

export function updateConversation(
  id: string,
  updates: { title?: string; model?: ModelId; useCase?: string }
): void {
  const fields: string[] = []
  const values: unknown[] = []

  if (updates.title !== undefined) {
    fields.push('title = ?')
    values.push(updates.title)
  }
  if (updates.model !== undefined) {
    fields.push('model = ?')
    values.push(updates.model)
  }
  if (updates.useCase !== undefined) {
    fields.push('use_case = ?')
    values.push(updates.useCase)
  }

  if (fields.length === 0) return
  values.push(id)
  getDb()
    .prepare(`UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values)
}

export function deleteConversation(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(id)
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
}

export function addMessage(params: {
  conversationId: string
  role: 'user' | 'assistant'
  contentOriginal: string
  contentSent: string
  contentDisplay: string
  replacements?: PseudoReplacement[]
  model?: ModelId
}): Message {
  const id = uuidv4()
  const now = new Date().toISOString()
  const replacements = params.replacements || []

  getDb()
    .prepare(
      `INSERT INTO messages
       (id, conversation_id, role, content_original, content_sent, content_display, replacements_json, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.conversationId,
      params.role,
      params.contentOriginal,
      params.contentSent,
      params.contentDisplay,
      replacements.length > 0 ? JSON.stringify(replacements) : null,
      params.model || null,
      now
    )

  return {
    id,
    role: params.role,
    content: params.contentDisplay,
    model: params.model,
    timestamp: new Date(now),
    pseudonymized: replacements.length > 0,
    replacementsCount: replacements.length,
  }
}
