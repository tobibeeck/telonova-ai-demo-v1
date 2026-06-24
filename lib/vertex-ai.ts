const GEMINI_ENDPOINT_BASE = 'https://aiplatform.eu.rep.googleapis.com/v1'
const GEMINI_MODEL = 'gemini-3.5-flash'

export async function chatWithGemini(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  systemPrompt?: string
): Promise<ReadableStream<Uint8Array>> {
  const project = process.env.GOOGLE_CLOUD_PROJECT
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'eu'
  const token = process.env.GOOGLE_VERTEX_TOKEN
  if (!project || !token) throw new Error('Vertex AI nicht konfiguriert (Project oder Token fehlt)')

  const endpoint = `${GEMINI_ENDPOINT_BASE}/projects/${project}/locations/${location}/publishers/google/models/${GEMINI_MODEL}:generateContent`

  const body = {
    contents: messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    systemInstruction: {
      parts: [{ text: systemPrompt || 'Du bist ein hilfreicher KI-Assistent für Fachprofis im DACH-Raum. Antworte auf Deutsch.' }],
    },
    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(`Vertex AI Fehler (${res.status}): ${detail}`)
  }

  const data = await res.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Leere Antwort von Vertex AI')

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      for (const word of text.split(' ')) {
        controller.enqueue(encoder.encode(word + ' '))
        await new Promise(r => setTimeout(r, 28 + Math.random() * 42))
      }
      controller.close()
    },
  })
}
