import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'telonova.db')

function ensureDataDir() {
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDir()
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    initSchema(db)
  }
  return db
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'gpt4',
      use_case TEXT NOT NULL DEFAULT 'allgemein',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content_original TEXT NOT NULL,
      content_sent TEXT NOT NULL,
      content_display TEXT NOT NULL,
      replacements_json TEXT,
      model TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content_pseudonymized TEXT NOT NULL,
      size INTEGER NOT NULL,
      chunks INTEGER NOT NULL DEFAULT 0,
      uploaded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      doc_name TEXT NOT NULL,
      text TEXT NOT NULL,
      tfidf_json TEXT NOT NULL,
      FOREIGN KEY (doc_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS api_audit_logs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      model TEXT NOT NULL,
      use_case TEXT NOT NULL,
      pseudo_enabled INTEGER NOT NULL,
      system_prompt TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      replacements_count INTEGER NOT NULL DEFAULT 0,
      pii_detected INTEGER NOT NULL DEFAULT 0,
      pii_findings_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(doc_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON api_audit_logs(created_at DESC);
  `)
}
