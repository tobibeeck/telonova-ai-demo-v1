import { NextRequest } from 'next/server'
import { pseudonymizeText, depseudonymize } from '@/lib/pseudo-service'
import { searchKnowledge } from '@/lib/vector-store'
import { chatWithGPT4 } from '@/lib/azure-openai'
import { chatWithClaude } from '@/lib/bedrock'
import { chatWithGemini } from '@/lib/vertex-ai'
import { getSystemPrompt, isValidUseCase } from '@/lib/prompts'
import { logApiCall } from '@/lib/audit-log'
import {
  createConversation,
  addMessage,
  updateConversation,
  getConversation,
} from '@/lib/conversations'
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
  const body = await req.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    model: ModelId
    useKnowledge: boolean
    pseudoEnabled: boolean
    useCase: string
    conversationId?: string
  }

  const { messages, model, useKnowledge, pseudoEnabled, useCase, conversationId } = body
  const resolvedUseCase = isValidUseCase(useCase) ? useCase : 'allgemein'

  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMessage) {
    return new Response('No user message', { status: 400 })
  }

  let pseudoResult
  try {
    pseudoResult = await pseudonymizeText(lastUserMessage.content, { enabled: pseudoEnabled })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pseudonymisierung fehlgeschlagen'
    return new Response(sseEvent({ type: 'error', message }), { headers: SSE_HEADERS })
  }

  const processedMessages = messages.map(m =>
    m === lastUserMessage ? { ...m, content: pseudoResult.pseudonymized } : m
  )

  let ragContext: string | undefined
  if (useKnowledge) {
    const results = searchKnowledge(pseudoResult.pseudonymized, 3)
    if (results.length > 0) {
      ragContext = results.map(r => `[Aus: ${r.docName}]\n${r.text}`).join('\n\n---\n\n')
    }
  }

  const systemPrompt = getSystemPrompt(resolvedUseCase, ragContext)

  logApiCall({
    model,
    useCase: resolvedUseCase,
    pseudoEnabled,
    originalUserMessage: lastUserMessage.content,
    sentUserMessage: pseudoResult.pseudonymized,
    replacements: pseudoResult.replacements,
  })

  let convId = conversationId
  if (!convId) {
    const conv = createConversation({
      title: lastUserMessage.content.slice(0, 40) + (lastUserMessage.content.length > 40 ? '…' : ''),
      model,
      useCase: resolvedUseCase,
    })
    convId = conv.id
  } else {
    const existing = getConversation(convId)
    if (existing && existing.messages.length === 0) {
      updateConversation(convId, {
        title: lastUserMessage.content.slice(0, 40) + (lastUserMessage.content.length > 40 ? '…' : ''),
      })
    }
    updateConversation(convId, { model, useCase: resolvedUseCase })
  }

  addMessage({
    conversationId: convId,
    role: 'user',
    contentOriginal: lastUserMessage.content,
    contentSent: pseudoResult.pseudonymized,
    contentDisplay: lastUserMessage.content,
    replacements: pseudoResult.replacements,
  })

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
      controller.enqueue(encoder.encode(sseEvent({
        type: 'pseudo',
        data: pseudoResult,
        conversationId: convId,
      })))

      const reader = aiStream.getReader()
      let accumulated = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = new TextDecoder().decode(value)
          accumulated += text
          controller.enqueue(encoder.encode(sseEvent({ type: 'token', data: text })))
        }

        const displayContent = pseudoEnabled && pseudoResult.replacements.length > 0
          ? depseudonymize(accumulated, pseudoResult.replacements)
          : accumulated

        addMessage({
          conversationId: convId!,
          role: 'assistant',
          contentOriginal: accumulated,
          contentSent: accumulated,
          contentDisplay: displayContent,
          replacements: pseudoResult.replacements,
          model,
        })

        controller.enqueue(encoder.encode(sseEvent({
          type: 'done',
          conversationId: convId,
          assistantContent: displayContent,
          replacements: pseudoResult.replacements,
          contentOriginal: accumulated,
        })))
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
