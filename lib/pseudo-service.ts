import type { PseudonymizationResult, PseudoReplacement } from './types'
import { checkOllamaHealth, generateJson } from './ollama-client'

const ENTITY_TYPES = new Set<PseudoReplacement['type']>([
  'PERSON', 'DATUM', 'TELEFON', 'EMAIL', 'IBAN', 'ADRESSE', 'ORG',
])

interface LlmEntity {
  text: string
  type: string
}

interface LlmResponse {
  entities: LlmEntity[]
}

const SYSTEM_PROMPT = `Du bist ein präziser NER-Extraktor für deutsche Texte nach DSGVO.
Extrahiere NUR echte personenbezogene oder sensible Daten – keine normalen Wörter.

Erlaubt:
- PERSON: konkrete Namen natürlicher Personen (z.B. "Max Mustermann", "Dr. Anna Schmidt")
- EMAIL, TELEFON, IBAN, ADRESSE, DATUM, ORG (Firmen mit Rechtsform)

Strikt NICHT markieren:
- Pronomen und Anreden: du, dir, dich, dein, Sie, Ihnen, Herr, Frau (ohne folgenden Namen)
- Alltagswörter, Verben, Artikel, Füllwörter
- Generische Begriffe ohne Identifikationswert

Antwote NUR mit validem JSON:
{"entities":[{"text":"...","type":"PERSON|DATUM|TELEFON|EMAIL|IBAN|ADRESSE|ORG"}]}
Leeres Array wenn nichts gefunden. Keine Erklärungen.`

const BLOCKED_TERMS = new Set([
  'du', 'dir', 'dich', 'dein', 'deine', 'deiner', 'deinem', 'deinen', 'deines',
  'ihr', 'ihre', 'ihrem', 'ihren', 'ihrer', 'ihres', 'euch', 'euere', 'euer',
  'sie', 'ihn', 'ihm', 'es', 'wir', 'uns', 'mir', 'mich', 'mein', 'meine', 'meiner',
  'er', 'sein', 'seine', 'seiner', 'seinem', 'seinen', 'seines',
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer',
  'herr', 'frau', 'herrn', 'frauen', 'geehrte', 'geehrter', 'hallo', 'bitte', 'danke',
  'ja', 'nein', 'und', 'oder', 'aber', 'wenn', 'dass', 'weil', 'also', 'noch', 'schon',
  'nicht', 'auch', 'nur', 'sehr', 'gern', 'gerne', 'liebe', 'lieber', 'beste', 'bester',
])

function shouldSkipEntity(text: string, type: PseudoReplacement['type']): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true

  const lower = trimmed.toLowerCase()
  if (BLOCKED_TERMS.has(lower)) return true

  const words = lower.split(/\s+/).filter(Boolean)
  if (words.length === 1 && BLOCKED_TERMS.has(words[0])) return true
  if (words.every(w => BLOCKED_TERMS.has(w))) return true

  if (type === 'PERSON') {
    if (trimmed.length < 3) return true
    if (/^(du|dir|dich|sie|ihr|ihm|ihn|es|wir|uns)$/i.test(trimmed)) return true
    if (words.length === 1 && !/^[A-ZÄÖÜ]/.test(trimmed)) return true
  }

  return false
}

function normalizeType(type: string): PseudoReplacement['type'] | null {
  const upper = type.toUpperCase() as PseudoReplacement['type']
  return ENTITY_TYPES.has(upper) ? upper : null
}

function applyReplacements(text: string, entities: LlmEntity[]): PseudonymizationResult {
  const sorted = [...entities]
    .filter(e => e.text && e.text.trim())
    .filter(e => {
      const type = normalizeType(e.type)
      return type !== null && !shouldSkipEntity(e.text, type)
    })
    .map(e => {
      const idx = text.indexOf(e.text)
      return idx >= 0 ? { ...e, start: idx, end: idx + e.text.length, type: normalizeType(e.type) } : null
    })
    .filter((e): e is LlmEntity & { start: number; end: number; type: PseudoReplacement['type'] } =>
      e !== null && e.type !== null
    )
    .sort((a, b) => b.start - a.start)

  const counters: Record<string, number> = {}
  const seen = new Map<string, string>()
  const replacements: PseudoReplacement[] = []
  let result = text

  for (const entity of sorted) {
    let token = seen.get(entity.text)
    if (!token) {
      counters[entity.type] = (counters[entity.type] || 0) + 1
      token = `[${entity.type}_${counters[entity.type]}]`
      seen.set(entity.text, token)
      replacements.unshift({ token, original: entity.text, type: entity.type })
    }
    result = result.slice(0, entity.start) + token + result.slice(entity.end)
  }

  const unique = replacements.filter(
    (r, idx, arr) => arr.findIndex(x => x.token === r.token) === idx
  )

  return { original: text, pseudonymized: result, replacements: unique }
}

export async function pseudonymizeText(
  text: string,
  options: { enabled?: boolean } = {}
): Promise<PseudonymizationResult> {
  const enabled = options.enabled !== false

  if (!text.trim()) {
    return { original: text, pseudonymized: text, replacements: [] }
  }

  if (!enabled) {
    return { original: text, pseudonymized: text, replacements: [] }
  }

  const healthy = await checkOllamaHealth()
  if (!healthy) {
    throw new Error(
      'Ollama ist nicht erreichbar. Pseudonymisierung erforderlich – bitte Ollama starten (docker compose up ollama).'
    )
  }

  const prompt = `Extrahiere NUR echte personenbezogene/sensible Daten (Namen, E-Mail, Telefon, IBAN, Adresse, Datum, Firma). Keine Pronomen wie "du"/"dir". Text:\n\n${text}`
  const llmResult = await generateJson<LlmResponse>(prompt, SYSTEM_PROMPT)
  const entities = llmResult.entities || []

  return applyReplacements(text, entities)
}

export { depseudonymize } from './pseudonymize'
