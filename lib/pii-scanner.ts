import type { PseudoReplacement } from './types'
import { pseudonymize as regexPseudonymize } from './pseudonymize'

export interface PiiFinding {
  type: PseudoReplacement['type']
  text: string
}

const PATTERNS: Array<{ type: PseudoReplacement['type']; re: RegExp }> = [
  { type: 'EMAIL', re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g },
  { type: 'IBAN', re: /\b(DE|AT)\d{2}[\s]?(\d{4}[\s]?){4,5}\d{0,4}\b/g },
  { type: 'TELEFON', re: /(\+49|0049|0|\+43)[\s\-]?(\(?\d{2,5}\)?[\s\-]?\d{3,}[\s\-]?\d{0,})/g },
  { type: 'DATUM', re: /\b\d{1,2}\.\d{1,2}\.(\d{4}|\d{2})\b/g },
]

export function scanForPii(text: string): PiiFinding[] {
  const findings: PiiFinding[] = []
  const seen = new Set<string>()

  for (const { type, re } of PATTERNS) {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    let m: RegExpExecArray | null
    while ((m = r.exec(text)) !== null) {
      const value = m[0].trim()
      if (value.length < 3 || seen.has(value)) continue
      if (type === 'TELEFON' && value.replace(/\D/g, '').length < 7) continue
      seen.add(value)
      findings.push({ type, text: value })
    }
  }

  return findings
}

export function scanPayloadForPii(payload: {
  systemPrompt: string
  messages: Array<{ role: string; content: string }>
}): PiiFinding[] {
  const combined = [
    payload.systemPrompt,
    ...payload.messages.map(m => m.content),
  ].join('\n')
  return scanForPii(combined)
}

/** Regex-only scan used for audit validation (not for cloud send). */
export function auditScan(text: string) {
  return regexPseudonymize(text)
}
