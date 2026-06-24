const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b'

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function generateJson<T>(prompt: string, system?: string): Promise<T> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      system,
      stream: false,
      format: 'json',
      options: { temperature: 0.1, num_predict: 512 },
    }),
    signal: AbortSignal.timeout(120000),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(`Ollama Fehler (${res.status}): ${detail}`)
  }

  const data = await res.json() as { response?: string }
  if (!data.response) throw new Error('Leere Antwort von Ollama')

  try {
    return JSON.parse(data.response) as T
  } catch {
    const match = data.response.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Ollama lieferte kein gültiges JSON')
    return JSON.parse(match[0]) as T
  }
}

export { OLLAMA_BASE_URL, OLLAMA_MODEL }
