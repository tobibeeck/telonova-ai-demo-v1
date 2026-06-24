'use client'

import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Sidebar from '@/components/sidebar/Sidebar'
import ChatInterface from '@/components/chat/ChatInterface'
import type { Conversation, Message, ModelId, PseudonymizationResult } from '@/lib/types'
import { MODELS } from '@/lib/types'

export default function ChatLayout() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelId>('gpt4')
  const [useKnowledge, setUseKnowledge] = useState(false)
  const [pseudoEnabled, setPseudoEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [lastPseudo, setLastPseudo] = useState<PseudonymizationResult | null>(null)
  const [isPseudoAnalyzing, setIsPseudoAnalyzing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatError, setChatError] = useState<string | null>(null)

  const currentConversation = conversations.find(c => c.id === currentId) ?? null

  const newConversation = useCallback(() => {
    const id = uuidv4()
    const conv: Conversation = {
      id,
      title: 'Neues Gespräch',
      messages: [],
      createdAt: new Date(),
      model: selectedModel,
    }
    setConversations(prev => [conv, ...prev])
    setCurrentId(id)
    setLastPseudo(null)
    setStreamingContent('')
  }, [selectedModel])

  const sendMessage = useCallback(async (content: string) => {
    let convId = currentId
    let conv = conversations.find(c => c.id === convId)

    if (!convId || !conv) {
      convId = uuidv4()
      conv = {
        id: convId,
        title: content.slice(0, 40) + (content.length > 40 ? '…' : ''),
        messages: [],
        createdAt: new Date(),
        model: selectedModel,
      }
      setConversations(prev => [conv!, ...prev])
      setCurrentId(convId)
    } else if (conv.messages.length === 0) {
      // Update title from first message
      setConversations(prev =>
        prev.map(c =>
          c.id === convId
            ? { ...c, title: content.slice(0, 40) + (content.length > 40 ? '…' : '') }
            : c
        )
      )
    }

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    // Add user message
    const updatedConv = { ...conv, messages: [...conv.messages, userMessage] }
    setConversations(prev => prev.map(c => (c.id === convId ? updatedConv : c)))

    setIsLoading(true)
    setStreamingContent('')
    setLastPseudo(null)
    setChatError(null)

    // Show pseudo analyzing state
    if (pseudoEnabled) {
      setIsPseudoAnalyzing(true)
      await new Promise(r => setTimeout(r, 800 + Math.random() * 600))
      setIsPseudoAnalyzing(false)
    }

    try {
      const apiMessages = updatedConv.messages.map(m => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          model: selectedModel,
          useKnowledge,
        }),
      })

      if (!response.ok || !response.body) throw new Error('Request failed')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const data = line.replace(/^data:\s*/, '').trim()
          if (!data) continue
          try {
            const event = JSON.parse(data)
            if (event.type === 'pseudo') {
              setLastPseudo(event.data)
            } else if (event.type === 'token') {
              accumulated += event.data
              setStreamingContent(accumulated)
            } else if (event.type === 'error') {
              setChatError(event.message || 'Unbekannter Fehler')
            } else if (event.type === 'done') {
              // finalize
            }
          } catch {
            // ignore
          }
        }
      }

      if (!accumulated) return

      // Save assistant message
      const model = MODELS.find(m => m.id === selectedModel)!
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: accumulated,
        model: selectedModel,
        timestamp: new Date(),
        pseudonymized: pseudoEnabled && (lastPseudo?.replacements?.length || 0) > 0,
        replacementsCount: lastPseudo?.replacements?.length || 0,
      }

      setConversations(prev =>
        prev.map(c =>
          c.id === convId
            ? { ...c, messages: [...c.messages, assistantMessage] }
            : c
        )
      )
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Verbindungsfehler')
    } finally {
      setIsLoading(false)
      setStreamingContent('')
    }
  }, [currentId, conversations, selectedModel, useKnowledge, pseudoEnabled, lastPseudo])

  return (
    <div className="flex h-screen overflow-hidden bg-main">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        conversations={conversations}
        currentId={currentId}
        onSelectConversation={setCurrentId}
        onNewConversation={newConversation}
        useKnowledge={useKnowledge}
        onToggleKnowledge={setUseKnowledge}
      />
      <ChatInterface
        conversation={currentConversation}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        onSendMessage={sendMessage}
        isLoading={isLoading}
        streamingContent={streamingContent}
        pseudoResult={lastPseudo}
        isPseudoAnalyzing={isPseudoAnalyzing}
        pseudoEnabled={pseudoEnabled}
        onTogglePseudo={setPseudoEnabled}
        useKnowledge={useKnowledge}
        onToggleKnowledge={setUseKnowledge}
        onNewConversation={newConversation}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        chatError={chatError}
        onClearError={() => setChatError(null)}
      />
    </div>
  )
}
