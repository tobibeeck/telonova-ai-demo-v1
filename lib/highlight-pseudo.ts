import type { PseudoReplacement } from './types'

const TYPE_COLORS: Record<PseudoReplacement['type'], string> = {
  PERSON: 'bg-blue-500/25 text-blue-200 border-blue-500/40',
  DATUM: 'bg-yellow-500/25 text-yellow-200 border-yellow-500/40',
  TELEFON: 'bg-green-500/25 text-green-200 border-green-500/40',
  EMAIL: 'bg-purple-500/25 text-purple-200 border-purple-500/40',
  IBAN: 'bg-red-500/25 text-red-200 border-red-500/40',
  ADRESSE: 'bg-orange-500/25 text-orange-200 border-orange-500/40',
  ORG: 'bg-cyan-500/25 text-cyan-200 border-cyan-500/40',
}

export function getTypeColor(type: PseudoReplacement['type']): string {
  return TYPE_COLORS[type]
}

interface Span {
  start: number
  end: number
  type: PseudoReplacement['type']
  label: string
}

function findSpans(text: string, replacements: PseudoReplacement[], match: 'original' | 'token'): Span[] {
  const spans: Span[] = []
  for (const r of replacements) {
    const needle = match === 'original' ? r.original : r.token
    if (!needle) continue
    let from = 0
    while (from < text.length) {
      const idx = text.indexOf(needle, from)
      if (idx === -1) break
      spans.push({
        start: idx,
        end: idx + needle.length,
        type: r.type,
        label: match === 'original' ? r.token : r.original,
      })
      from = idx + needle.length
    }
  }
  return spans.sort((a, b) => a.start - b.start)
}

function mergeNonOverlapping(spans: Span[]): Span[] {
  const result: Span[] = []
  for (const span of spans) {
    const last = result[result.length - 1]
    if (last && span.start < last.end) continue
    result.push(span)
  }
  return result
}

export function buildHighlightedSegments(
  text: string,
  replacements: PseudoReplacement[],
  mode: 'outgoing' | 'incoming' | 'tokens'
): Array<{ text: string; highlight?: PseudoReplacement['type']; title?: string }> {
  if (!replacements.length) return [{ text }]

  const match = mode === 'tokens' ? 'token' : 'original'
  const spans = mergeNonOverlapping(findSpans(text, replacements, match))
  if (!spans.length) return [{ text }]

  const segments: Array<{ text: string; highlight?: PseudoReplacement['type']; title?: string }> = []
  let cursor = 0

  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({ text: text.slice(cursor, span.start) })
    }
    const title = mode === 'outgoing'
      ? `→ ${span.label}`
      : mode === 'tokens'
        ? `← ${span.label}`
        : `← ${span.label} (von API)`
    segments.push({
      text: text.slice(span.start, span.end),
      highlight: span.type,
      title,
    })
    cursor = span.end
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) })
  }

  return segments
}
