import { v4 as uuidv4 } from 'uuid'
import { getDb } from './db'
import { scanForPii, type PiiFinding } from './pii-scanner'
import type { ModelId, PseudoReplacement } from './types'

export interface AuditLogEntry {
  id: string
  createdAt: string
  model: ModelId
  useCase: string
  pseudoEnabled: boolean
  originalUserMessage: string
  sentUserMessage: string
  replacements: PseudoReplacement[]
  replacementsCount: number
  piiDetected: boolean
  piiFindings: PiiFinding[]
}

interface StoredAuditPayload {
  originalUserMessage?: string
  sentUserMessage?: string
  replacements?: PseudoReplacement[]
  messages?: Array<{ role: string; content: string }>
}

export function logApiCall(params: {
  model: ModelId
  useCase: string
  pseudoEnabled: boolean
  originalUserMessage: string
  sentUserMessage: string
  replacements: PseudoReplacement[]
}): AuditLogEntry {
  const findings = scanForPii(params.sentUserMessage)

  const payload: StoredAuditPayload = {
    originalUserMessage: params.originalUserMessage,
    sentUserMessage: params.sentUserMessage,
    replacements: params.replacements,
  }

  const entry: AuditLogEntry = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    model: params.model,
    useCase: params.useCase,
    pseudoEnabled: params.pseudoEnabled,
    originalUserMessage: params.originalUserMessage,
    sentUserMessage: params.sentUserMessage,
    replacements: params.replacements,
    replacementsCount: params.replacements.length,
    piiDetected: findings.length > 0,
    piiFindings: findings,
  }

  getDb()
    .prepare(
      `INSERT INTO api_audit_logs
       (id, created_at, model, use_case, pseudo_enabled, system_prompt, messages_json, replacements_count, pii_detected, pii_findings_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.id,
      entry.createdAt,
      entry.model,
      entry.useCase,
      entry.pseudoEnabled ? 1 : 0,
      '',
      JSON.stringify(payload),
      entry.replacementsCount,
      entry.piiDetected ? 1 : 0,
      JSON.stringify(entry.piiFindings)
    )

  return entry
}

function parseStoredPayload(row: {
  messages_json: string
  replacements_count: number
}): StoredAuditPayload {
  try {
    return JSON.parse(row.messages_json) as StoredAuditPayload
  } catch {
    return {}
  }
}

export function getAuditLogs(limit = 50, offset = 0): AuditLogEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM api_audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as Array<{
      id: string
      created_at: string
      model: ModelId
      use_case: string
      pseudo_enabled: number
      messages_json: string
      replacements_count: number
      pii_detected: number
      pii_findings_json: string
    }>

  return rows.map(row => {
    const payload = parseStoredPayload(row)
    const lastUser = payload.messages
      ? [...payload.messages].reverse().find(m => m.role === 'user')
      : undefined

    return {
      id: row.id,
      createdAt: row.created_at,
      model: row.model,
      useCase: row.use_case,
      pseudoEnabled: row.pseudo_enabled === 1,
      originalUserMessage: payload.originalUserMessage || lastUser?.content || '',
      sentUserMessage: payload.sentUserMessage || lastUser?.content || '',
      replacements: payload.replacements || [],
      replacementsCount: row.replacements_count,
      piiDetected: row.pii_detected === 1,
      piiFindings: JSON.parse(row.pii_findings_json || '[]'),
    }
  })
}

export function getAuditLogCount(): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) as count FROM api_audit_logs')
    .get() as { count: number }
  return row.count
}
