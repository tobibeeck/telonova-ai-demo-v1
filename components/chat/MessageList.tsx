'use client'

import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Shield } from 'lucide-react'
import type { Message, ModelId } from '@/lib/types'
import { MODELS } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  messages: Message[]
  isLoading: boolean
  streamingContent: string
  selectedModel: ModelId
}

export default function MessageList({ messages, isLoading, streamingContent, selectedModel }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {messages.map(msg => (
        <MessageRow key={msg.id} message={msg} />
      ))}

      {/* Streaming message */}
      {isLoading && streamingContent && (
        <StreamingRow content={streamingContent} model={selectedModel} />
      )}

      {/* Loading indicator (before first token) */}
      {isLoading && !streamingContent && (
        <div className="flex items-start gap-4">
          <ModelAvatar model={selectedModel} />
          <div className="flex items-center gap-1 pt-2">
            <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

function MessageRow({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] flex items-start gap-3">
          <div className="bg-[#2f2f2f] rounded-2xl rounded-tr-sm px-4 py-3">
            <p className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">{message.content}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
            <User className="w-4 h-4 text-gray-300" />
          </div>
        </div>
      </div>
    )
  }

  const model = message.model ? MODELS.find(m => m.id === message.model) : null

  return (
    <div className="flex items-start gap-4 animate-fade-in">
      <ModelAvatar model={message.model || 'gpt4'} />
      <div className="flex-1 min-w-0 pt-0.5">
        {model && (
          <div className="flex items-center gap-2 mb-2">
            <span className={cn('text-xs font-medium', model.color)}>{model.name}</span>
            <span className="text-xs text-gray-600">{model.badge}</span>
            {message.pseudonymized && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Shield className="w-3 h-3" />
                <span>Pseudonymisiert</span>
              </div>
            )}
          </div>
        )}
        <div className="prose-chat text-sm text-gray-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

function StreamingRow({ content, model }: { content: string; model: ModelId }) {
  const m = MODELS.find(m => m.id === model)!
  return (
    <div className="flex items-start gap-4">
      <ModelAvatar model={model} />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn('text-xs font-medium', m.color)}>{m.name}</span>
          <span className="text-xs text-gray-600">{m.badge}</span>
        </div>
        <div className="prose-chat text-sm text-gray-100 streaming-cursor">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

function ModelAvatar({ model }: { model: ModelId }) {
  const colors: Record<ModelId, string> = {
    gpt4: 'bg-model-gpt',
    claude: 'bg-model-claude',
    gemini: 'bg-model-gemini',
  }
  const labels: Record<ModelId, string> = { gpt4: 'G', claude: 'C', gemini: 'G' }

  return (
    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold mt-0.5', colors[model])}>
      {labels[model]}
    </div>
  )
}
