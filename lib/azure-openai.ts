import OpenAI from 'openai'

function getClient() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  if (!endpoint || !apiKey) throw new Error('Azure OpenAI nicht konfiguriert (Endpoint oder API Key fehlt)')

  return new OpenAI({
    apiKey,
    baseURL: `${endpoint}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5-mini'}`,
    defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview' },
    defaultHeaders: { 'api-key': apiKey },
  })
}

export async function chatWithGPT4(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  systemPrompt?: string
): Promise<ReadableStream<Uint8Array>> {
  const client = getClient()

  const allMessages = systemPrompt
    ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
    : messages

  const stream = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5-mini',
    messages: allMessages,
    stream: true,
  })

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ''
          if (text) controller.enqueue(encoder.encode(text))
        }
      } finally {
        controller.close()
      }
    },
  })
}
