const MODEL_ID = 'eu.anthropic.claude-sonnet-4-6'

export async function chatWithClaude(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  systemPrompt?: string
): Promise<ReadableStream<Uint8Array>> {
  const region = process.env.AWS_REGION || 'eu-central-1'
  const token = process.env.AWS_BEARER_TOKEN
  if (!token) throw new Error('AWS_BEARER_TOKEN nicht konfiguriert')

  const body = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1024,
    system: systemPrompt || 'Du bist ein hilfreicher KI-Assistent für Rechts- und Fachprofis in der DACH-Region.',
    messages: messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  }

  const res = await fetch(
    `https://bedrock-runtime.${region}.amazonaws.com/model/${MODEL_ID}/invoke`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(`Bedrock API Fehler (${res.status}): ${detail}`)
  }

  const data = await res.json()
  const text: string = data.content?.[0]?.text
  if (!text) throw new Error('Leere Antwort von Bedrock API')

  return wordStream(text)
}

function wordStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      for (const word of text.split(' ')) {
        controller.enqueue(encoder.encode(word + ' '))
        await new Promise(r => setTimeout(r, 25 + Math.random() * 35))
      }
      controller.close()
    },
  })
}
