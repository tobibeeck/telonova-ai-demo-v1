import { VertexAI } from '@google-cloud/vertexai'

function getApiEndpoint(location: string): string | undefined {
  if (location === 'eu') return 'aiplatform.eu.rep.googleapis.com'
  if (location === 'us') return 'aiplatform.us.rep.googleapis.com'
  return undefined
}

export async function chatWithGemini(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  systemPrompt?: string
): Promise<ReadableStream<Uint8Array>> {
  const project = process.env.GOOGLE_CLOUD_PROJECT
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'eu'
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash'

  if (!project) {
    throw new Error('Vertex AI nicht konfiguriert (GOOGLE_CLOUD_PROJECT fehlt)')
  }

  const vertexAI = new VertexAI({
    project,
    location,
    apiEndpoint: getApiEndpoint(location),
  })
  const model = vertexAI.getGenerativeModel({
    model: modelName,
    systemInstruction: {
      role: 'system',
      parts: [{ text: systemPrompt || 'Du bist ein hilfreicher KI-Assistent für Fachprofis im DACH-Raum. Antworte auf Deutsch.' }],
    },
  })

  const history = messages
    .filter(m => m.role !== 'system')
    .slice(0, -1)
    .map(m => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }))

  const lastMessage = messages.filter(m => m.role !== 'system').at(-1)
  if (!lastMessage) throw new Error('Keine Nachricht vorhanden')

  const chat = model.startChat({ history })
  const result = await chat.sendMessageStream(lastMessage.content)

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const chunk of result.stream) {
          const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || ''
          if (text) controller.enqueue(encoder.encode(text))
        }
      } finally {
        controller.close()
      }
    },
  })
}
