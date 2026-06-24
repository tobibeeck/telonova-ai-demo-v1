import { NextRequest } from 'next/server'
import { pseudonymize } from '@/lib/pseudonymize'
import { searchKnowledge } from '@/lib/vector-store'
import { chatWithGPT4 } from '@/lib/azure-openai'
import { chatWithClaude } from '@/lib/bedrock'
import { chatWithGemini } from '@/lib/vertex-ai'
import type { ModelId } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
}

function sseEvent(payload: object) {
  return `data: ${JSON.stringify(payload)}\n\n`
}

export async function POST(req: NextRequest) {
  const { messages, model, useKnowledge } = await req.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    model: ModelId
    useKnowledge: boolean
  }

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMessage) {
    return new Response('No user message', { status: 400 })
  }

  const pseudoResult = pseudonymize(lastUserMessage.content)

  const processedMessages = messages.map(m =>
    m === lastUserMessage ? { ...m, content: pseudoResult.pseudonymized } : m
  )

  let systemPrompt = `Du bist ein professioneller KI-Assistent für Anwälte, Ärzte, Notare und andere Fachprofis im DACH-Raum.
Du arbeitest DSGVO-konform: alle Daten werden ausschließlich auf EU-Servern verarbeitet.
Antworte präzise, professionell und auf Deutsch. Nutze Markdown für Formatierungen wenn sinnvoll.`

  if (useKnowledge) {
    const results = searchKnowledge(pseudoResult.pseudonymized, 3)
    if (results.length > 0) {
      const context = results.map(r => `[Aus: ${r.docName}]\n${r.text}`).join('\n\n---\n\n')
      systemPrompt += `\n\nRelevante Informationen aus der Wissensdatenbank:\n\n${context}\n\nNutze diese Informationen wenn relevant für deine Antwort.`
    }
  }

  let aiStream: ReadableStream<Uint8Array>
  try {
    if (model === 'gpt4') {
      aiStream = await chatWithGPT4(processedMessages, systemPrompt)
    } else if (model === 'claude') {
      aiStream = await chatWithClaude(processedMessages, systemPrompt)
    } else {
      aiStream = await chatWithGemini(processedMessages, systemPrompt)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return new Response(sseEvent({ type: 'error', message }), { headers: SSE_HEADERS })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(sseEvent({ type: 'pseudo', data: pseudoResult })))
      const reader = aiStream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = new TextDecoder().decode(value)
          controller.enqueue(encoder.encode(sseEvent({ type: 'token', data: text })))
        }
        controller.enqueue(encoder.encode(sseEvent({ type: 'done' })))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler während des Streamings'
        controller.enqueue(encoder.encode(sseEvent({ type: 'error', message })))
      } finally {
        controller.close()
        reader.releaseLock()
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
