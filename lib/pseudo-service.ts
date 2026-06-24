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
Extrahiere personenbezogene und sensible Daten als einzelne Entity-Texte – nie ganze Sätze.

Entity-Typen:
- PERSON: konkrete Namen natürlicher Personen (Vor- und/oder Nachname)
- EMAIL, TELEFON, IBAN, ADRESSE, DATUM, ORG (Firmen mit Rechtsform)

WICHTIG bei PERSON:
- Namen IMMER extrahieren, auch wenn der Satz mit "Hallo", "Servus" o.ä. beginnt
- Nur den Namen markieren, nicht "Hallo", "ich", "bin", "heiße"
- Beispiele:
  - "Hallo ich bin Tobias Beeck" → {"entities":[{"text":"Tobias Beeck","type":"PERSON"}]}
  - "Mein Name ist Anna Schmidt" → {"entities":[{"text":"Anna Schmidt","type":"PERSON"}]}
  - "Ich heiße Dr. Max Mustermann" → {"entities":[{"text":"Dr. Max Mustermann","type":"PERSON"}]}

Keine Entities (leeres Array):
- "Hallo, wer bist du?" → []
- "Servus" → []
- "Wie kann ich helfen?" → []

Weitere Beispiele:
- "Termin mit Max Mustermann am 12.03.2025" → PERSON: "Max Mustermann", DATUM: "12.03.2025"

Antwote NUR mit validem JSON:
{"entities":[{"text":"...","type":"PERSON|DATUM|TELEFON|EMAIL|IBAN|ADRESSE|ORG"}]}
Leeres Array wenn nichts gefunden. Keine Erklärungen.`

const RETRY_SYSTEM_PROMPT = `Du extrahierst NUR Personennamen aus deutschen Texten.
Antwote NUR mit JSON: {"entities":[{"text":"...","type":"PERSON"}]}

Regeln:
- Vor- und Nachname zusammen als eine Entity (z.B. "Tobias Beeck")
- Auch nach: ich bin, ich heiße, mein Name ist, nennen Sie mich
- Titel mit Name erlaubt: Dr. Anna Schmidt
- Keine Begrüßungen, keine Verben, keine Pronomen als Entity
- Leeres Array nur wenn wirklich kein Personenname vorkommt`

const RETRY_MAX_TEXT_LENGTH = 500

const BLOCKED_TERMS = new Set([
  'du', 'dir', 'dich', 'dein', 'deine', 'deiner', 'deinem', 'deinen', 'deines',
  'ihr', 'ihre', 'ihrem', 'ihren', 'ihrer', 'ihres', 'euch', 'euere', 'euer',
  'sie', 'ihn', 'ihm', 'es', 'wir', 'uns', 'mir', 'mich', 'mein', 'meine', 'meiner',
  'er', 'sein', 'seine', 'seiner', 'seinem', 'seinen', 'seines',
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer',
  'herr', 'frau', 'herrn', 'frauen', 'geehrte', 'geehrter', 'hallo', 'bitte', 'danke',
  'ja', 'nein', 'und', 'oder', 'aber', 'wenn', 'dass', 'weil', 'also', 'noch', 'schon',
  'nicht', 'auch', 'nur', 'sehr', 'gern', 'gerne', 'liebe', 'lieber', 'beste', 'bester',
  'wer', 'was', 'wann', 'wo', 'wie', 'warum', 'womit', 'wofür', 'weshalb',
  'bist', 'bin', 'ist', 'sind', 'war', 'waren', 'habe', 'hast', 'hat', 'haben',
  'servus', 'moin', 'grüß', 'gott', 'tschüss', 'ciao', 'hello', 'hey', 'hi',
  'guten', 'tag', 'morgen', 'abend', 'nacht', 'willkommen', 'danke', 'vielen', 'dank',
  'können', 'kannst', 'kann', 'können', 'helfen', 'helfe', 'hilf', 'geht', 'gehen',
])

const GREETING_OR_QUESTION =
  /^(hallo|servus|moin|hi|hey|guten\s+(tag|morgen|abend)|grüß\s+gott)[\s,!.?]*$|^(wer|was|wo|wann|wie|warum)\b/i

function cleanToken(word: string): string {
  return word.replace(/^[,.!?;:]+|[,.!?;:]+$/g, '').toLowerCase()
}

function looksLikePersonName(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (GREETING_OR_QUESTION.test(trimmed)) return false

  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.every(w => BLOCKED_TERMS.has(cleanToken(w)))) return false

  const nameTokens = words.filter(w => {
    const clean = w.replace(/[,.!?;:]/g, '')
    if (!clean) return false
    if (BLOCKED_TERMS.has(clean.toLowerCase())) return false
    if (/^(Dr|Prof|Herr|Frau|Hr|Fr)\.?$/i.test(clean)) return false
    return /^[A-ZÄÖÜ][a-zäöüß-]+$/.test(clean) || /^[A-ZÄÖÜ]{2,}$/.test(clean)
  })

  if (nameTokens.length === 0) return false

  const greetingOnly =
    words.length <= 3 &&
    words.every(w => BLOCKED_TERMS.has(cleanToken(w)) || /^(hallo|servus|moin|hi|hey)$/i.test(cleanToken(w)))
  if (greetingOnly) return false

  if (words.length === 1) return nameTokens.length === 1
  return nameTokens.length >= 1 && words.length <= 8
}

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
    if (!looksLikePersonName(trimmed)) return true
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

function mergeEntities(primary: LlmEntity[], secondary: LlmEntity[]): LlmEntity[] {
  const seen = new Set<string>()
  const merged: LlmEntity[] = []
  for (const entity of [...primary, ...secondary]) {
    if (!entity.text?.trim()) continue
    const key = `${entity.type}:${entity.text.trim()}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(entity)
  }
  return merged
}

async function extractEntities(text: string): Promise<LlmEntity[]> {
  const prompt = `Extrahiere personenbezogene/sensible Daten (Namen, E-Mail, Telefon, IBAN, Adresse, Datum, Firma).
Personennamen auch in Sätzen wie "Hallo ich bin …", "Mein Name ist …", "Ich heiße …" – nur den Namen, nicht die Begrüßung.
Nur einzelne Entity-Texte, keine ganzen Sätze.

Text:\n\n${text}`

  const llmResult = await generateJson<LlmResponse>(prompt, SYSTEM_PROMPT)
  let entities = llmResult.entities || []

  if (entities.length === 0 && text.length <= RETRY_MAX_TEXT_LENGTH) {
    const retryResult = await generateJson<LlmResponse>(
      `Welche Personennamen (Vor- und Nachname) stehen in diesem Text? Auch nach "ich bin", "ich heiße", "mein Name ist".\n\n${text}`,
      RETRY_SYSTEM_PROMPT
    )
    entities = mergeEntities(entities, retryResult.entities || [])
  }

  return entities
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

  const entities = await extractEntities(text)
  return applyReplacements(text, entities)
}

export { depseudonymize } from './pseudonymize'
