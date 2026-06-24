'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowUp, Shield, Database, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onSend: (content: string) => void
  isLoading: boolean
  pseudoEnabled: boolean
  onTogglePseudo: (v: boolean) => void
  useKnowledge: boolean
  onToggleKnowledge: (v: boolean) => void
}

export default function MessageInput({
  onSend,
  isLoading,
  pseudoEnabled,
  onTogglePseudo,
  useKnowledge,
  onToggleKnowledge,
}: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const handleSend = useCallback(() => {
    const text = value.trim()
    if (!text || isLoading) return
    onSend(text)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, isLoading, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const canSend = value.trim().length > 0 && !isLoading

  return (
    <div className="px-4 pb-4 pt-2 flex-shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className={cn(
          'flex flex-col rounded-2xl border transition-colors',
          'bg-input border-border focus-within:border-gray-500'
        )}>
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht eingeben…"
            rows={1}
            className="w-full bg-transparent text-white placeholder-gray-500 text-sm px-4 pt-3.5 pb-2 resize-none outline-none leading-relaxed"
            style={{ minHeight: '52px', maxHeight: '200px' }}
          />

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-1">
              {/* Pseudonymisierung toggle */}
              <button
                onClick={() => onTogglePseudo(!pseudoEnabled)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  pseudoEnabled
                    ? 'bg-model-gpt/20 text-model-gpt hover:bg-model-gpt/30'
                    : 'text-gray-500 hover:bg-white/10 hover:text-gray-300'
                )}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Pseudonymisierung</span>
                <span className={cn('w-1.5 h-1.5 rounded-full', pseudoEnabled ? 'bg-model-gpt' : 'bg-gray-600')} />
              </button>

              {/* Wissensdatenbank toggle */}
              <button
                onClick={() => onToggleKnowledge(!useKnowledge)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  useKnowledge
                    ? 'bg-model-gpt/20 text-model-gpt hover:bg-model-gpt/30'
                    : 'text-gray-500 hover:bg-white/10 hover:text-gray-300'
                )}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Wissen</span>
                <span className={cn('w-1.5 h-1.5 rounded-full', useKnowledge ? 'bg-model-gpt' : 'bg-gray-600')} />
              </button>
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                canSend
                  ? 'bg-white hover:bg-gray-200 text-black'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <Square className="w-3 h-3 fill-current" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-2 text-center space-y-0.5">
          <p className="text-xs text-gray-500">
            KI-Antworten können fehlerhaft sein – wichtige Informationen bitte immer selbst prüfen.
          </p>
          <p className="text-xs text-gray-600">
            Dieses System nutzt KI gem. EU AI Act Art. 50 · Eingaben werden pseudonymisiert · EU-Server · DSGVO-konform
          </p>
        </div>
      </div>
    </div>
  )
}
