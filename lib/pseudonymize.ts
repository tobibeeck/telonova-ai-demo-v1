import type { PseudonymizationResult, PseudoReplacement } from './types'

type ReplacementType = PseudoReplacement['type']

interface Detection {
  start: number
  end: number
  original: string
  type: ReplacementType
}

function matchAll(text: string, re: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = []
  let m: RegExpExecArray | null
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  while ((m = r.exec(text)) !== null) results.push(m)
  return results
}

export function pseudonymize(text: string): PseudonymizationResult {
  if (!text.trim()) {
    return { original: text, pseudonymized: text, replacements: [] }
  }

  const detections: Detection[] = []

  // Email
  matchAll(text, /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g).forEach(m => {
    detections.push({ start: m.index!, end: m.index! + m[0].length, original: m[0], type: 'EMAIL' })
  })

  // IBAN (German + Austrian)
  matchAll(text, /\b(DE|AT)\d{2}[\s]?(\d{4}[\s]?){4,5}\d{0,4}\b/g).forEach(m => {
    if (!overlaps(detections, m.index!, m.index! + m[0].length))
      detections.push({ start: m.index!, end: m.index! + m[0].length, original: m[0], type: 'IBAN' })
  })

  // Phone numbers (German/Austrian)
  matchAll(text, /(\+49|0049|0|\+43)[\s\-]?(\(?\d{2,5}\)?[\s\-]?\d{3,}[\s\-]?\d{0,})/g).forEach(m => {
    if (m[0].replace(/\D/g, '').length >= 7 && !overlaps(detections, m.index!, m.index! + m[0].length))
      detections.push({ start: m.index!, end: m.index! + m[0].length, original: m[0].trim(), type: 'TELEFON' })
  })

  // Dates (DD.MM.YYYY or DD.MM.YY)
  matchAll(text, /\b\d{1,2}\.\d{1,2}\.(\d{4}|\d{2})\b/g).forEach(m => {
    if (!overlaps(detections, m.index!, m.index! + m[0].length))
      detections.push({ start: m.index!, end: m.index! + m[0].length, original: m[0], type: 'DATUM' })
  })

  // Addresses
  matchAll(text, /[A-ZÄÖÜ][a-zäöüß]+(straße|strasse|str\.|weg|platz|gasse|allee|ring|damm|ufer|promenade)\s+\d+[a-z]?(\s*,\s*\d{4,5}\s+[A-ZÄÖÜ][a-zäöüß]+)?/gi).forEach(m => {
    if (!overlaps(detections, m.index!, m.index! + m[0].length))
      detections.push({ start: m.index!, end: m.index! + m[0].length, original: m[0], type: 'ADRESSE' })
  })

  // Organizations
  matchAll(text, /[A-ZÄÖÜ][A-Za-zäöüÄÖÜß\s&\-]+\s+(GmbH|AG|KG|e\.V\.|GbR|OHG|KGaA|SE|UG|Stiftung)(&\s*Co\.\s*KG)?/g).forEach(m => {
    if (!overlaps(detections, m.index!, m.index! + m[0].length))
      detections.push({ start: m.index!, end: m.index! + m[0].length, original: m[0].trim(), type: 'ORG' })
  })

  // Persons after titles
  matchAll(text, /\b(Herr|Frau|Hr\.|Fr\.|Dr\.|Prof\.|Dr\.-Ing\.|Dipl\.-Ing\.|Mag\.|DI|RA|Notar|Notarin)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)/g).forEach(m => {
    const nameStart = m.index! + m[0].indexOf(m[2])
    const nameEnd = nameStart + m[2].length
    if (!overlaps(detections, nameStart, nameEnd))
      detections.push({ start: nameStart, end: nameEnd, original: m[2], type: 'PERSON' })
  })

  // Standalone capitalized full names after person-related words
  const skipWords = new Set(['Der', 'Die', 'Das', 'Den', 'Dem', 'Ein', 'Eine', 'Einen', 'Mit', 'Von', 'Vom', 'Zur', 'Zum', 'Durch', 'Nach', 'Über', 'Unter', 'Vor', 'Hinter', 'Bei', 'Aus', 'Auf', 'Für', 'Gegen', 'Ohne', 'Seit', 'Während', 'Wegen', 'Trotz', 'Bitte', 'Sehr', 'Geehrte', 'Geehrter', 'Viele', 'Liebe', 'Lieber', 'Beste', 'Bester', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'])
  matchAll(text, /\b([A-ZÄÖÜ][a-zäöüß]{2,})\s+([A-ZÄÖÜ][a-zäöüß]{2,})\b/g).forEach(m => {
    if (!skipWords.has(m[1]) && !skipWords.has(m[2]) && !overlaps(detections, m.index!, m.index! + m[0].length)) {
      const before = text.slice(Math.max(0, m.index! - 20), m.index!)
      if (/\b(Mandant|Mandantin|Patient|Patientin|Klient|Klientin|Antragsteller|Beklagte[rn]?|Kläger|Zeuge|Zeugin|Erblasser|Erbin|Erbe|Schuldner|Gläubiger)\b/i.test(before)) {
        detections.push({ start: m.index!, end: m.index! + m[0].length, original: m[0], type: 'PERSON' })
      }
    }
  })

  // Sort by position
  detections.sort((a, b) => a.start - b.start)

  // Build replacements with counters per type
  const counters: Record<string, number> = {}
  const replacements: PseudoReplacement[] = []
  const seen = new Map<string, string>()

  detections.forEach(d => {
    if (seen.has(d.original)) {
      replacements.push({ token: seen.get(d.original)!, original: d.original, type: d.type })
      return
    }
    counters[d.type] = (counters[d.type] || 0) + 1
    const token = `[${d.type}_${counters[d.type]}]`
    seen.set(d.original, token)
    replacements.push({ token, original: d.original, type: d.type })
  })

  // Build pseudonymized text
  let result = ''
  let cursor = 0
  detections.forEach(d => {
    result += text.slice(cursor, d.start)
    result += seen.get(d.original) || d.original
    cursor = d.end
  })
  result += text.slice(cursor)

  // Deduplicate replacements for display
  const uniqueReplacements = replacements.filter(
    (r, idx, arr) => arr.findIndex(x => x.token === r.token) === idx
  )

  return { original: text, pseudonymized: result, replacements: uniqueReplacements }
}

function overlaps(detections: Detection[], start: number, end: number): boolean {
  return detections.some(d => start < d.end && end > d.start)
}

export function depseudonymize(text: string, replacements: PseudoReplacement[]): string {
  let result = text
  replacements.forEach(r => {
    result = result.split(r.token).join(r.original)
  })
  return result
}
