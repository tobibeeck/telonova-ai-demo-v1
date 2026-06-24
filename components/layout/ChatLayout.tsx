'use client'

import { useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Sidebar from '@/components/sidebar/Sidebar'
import ChatInterface from '@/components/chat/ChatInterface'
import type { Conversation, Message, ModelId, PseudonymizationResult } from '@/lib/types'
import { MODELS } from '@/lib/types'
import type { UseCaseOption } from '@/components/chat/UseCaseSelector'

export default function ChatLayout() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelId>('gpt4')
  const [selectedUseCase, setSelectedUseCase] = useState('allgemein')
  const [useCases, setUseCases] = useState<UseCaseOption[]>([])
  const [useKnowledge, setUseKnowledge] = useState(false)
  const [pseudoEnabled, setPseudoEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [lastPseudo, setLastPseudo] = useState<PseudonymizationResult | null>(null)
  const [isPseudoAnalyzing, setIsPseudoAnalyzing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatError, setChatError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/conversations').then(r => r.json()),
      fetch('/api/prompts').then(r => r.json()),
    ]).then(([convData, promptData]) => {
      const parsed = (convData.conversations || []).map((c: Conversation) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        messages: c.messages.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      }))
      setConversations(parsed)
      setUseCases(promptData.useCases || [])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const currentConversation = conversations.find(c => c.id === currentId) ?? null

  useEffect(() => {
    if (currentConversation?.useCase) {
      setSelectedUseCase(currentConversation.useCase)
    }
    if (currentConversation?.model) {
      setSelectedModel(currentConversation.model)
    }
  }, [currentId, currentConversation?.useCase, currentConversation?.model])

  const newConversation = useCallback(async () => {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel, useCase: selectedUseCase }),
    })
    const data = await res.json()
    const conv = data.conversation as Conversation
    setConversations(prev => [conv, ...prev])
    setCurrentId(conv.id)
    setLastPseudo(null)
    setStreamingContent('')
    setChatError(null)
  }, [selectedModel, selectedUseCase])

  const sendMessage = useCallback(async (content: string) => {
    let convId = currentId
    let conv = conversations.find(c => c.id === convId)

    if (!convId || !conv) {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          useCase: selectedUseCase,
          title: content.slice(0, 40) + (content.length > 40 ? '…' : ''),
        }),
      })
      const data = await res.json()
      conv = data.conversation as Conversation
      convId = conv.id
      setConversations(prev => [conv!, ...prev])
      setCurrentId(convId)
    }

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    const updatedConv = { ...conv, messages: [...conv.messages, userMessage] }
    setConversations(prev => prev.map(c => (c.id === convId ? updatedConv : c)))

    setIsLoading(true)
    setStreamingContent('')
    setLastPseudo(null)
    setChatError(null)

    if (pseudoEnabled) {
      setIsPseudoAnalyzing(true)
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
          pseudoEnabled,
          useCase: selectedUseCase,
          conversationId: convId,
        }),
      })

      if (!response.ok || !response.body) throw new Error('Request failed')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''
      let pseudoData: PseudonymizationResult | null = null
      let returnedConvId = convId
      let assistantContent = ''

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
              pseudoData = event.data
              setLastPseudo(event.data)
              setIsPseudoAnalyzing(false)
              if (event.conversationId) returnedConvId = event.conversationId
              setConversations(prev =>
                prev.map(c => {
                  if (c.id !== (event.conversationId || convId)) return c
                  const msgs = c.messages.map(m =>
                    m.id === userMessage.id
                      ? {
                          ...m,
                          replacements: event.data.replacements,
                          contentSent: event.data.pseudonymized,
                          pseudonymized: event.data.replacements.length > 0,
                          replacementsCount: event.data.replacements.length,
                        }
                      : m
                  )
                  return { ...c, messages: msgs }
                })
              )
            } else if (event.type === 'token') {
              accumulated += event.data
              setStreamingContent(accumulated)
            } else if (event.type === 'error') {
              setChatError(event.message || 'Unbekannter Fehler')
            } else if (event.type === 'done') {
              if (event.conversationId) returnedConvId = event.conversationId
              if (event.assistantContent) assistantContent = event.assistantContent
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      setIsPseudoAnalyzing(false)

      if (!accumulated) return

      const model = MODELS.find(m => m.id === selectedModel)!
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: assistantContent || accumulated,
        contentOriginal: accumulated,
        contentSent: accumulated,
        replacements: pseudoData?.replacements,
        model: selectedModel,
        timestamp: new Date(),
        pseudonymized: pseudoEnabled && (pseudoData?.replacements?.length || 0) > 0,
        replacementsCount: pseudoData?.replacements?.length || 0,
      }

      setConversations(prev =>
        prev.map(c =>
          c.id === returnedConvId
            ? {
                ...c,
                useCase: selectedUseCase,
                model: selectedModel,
                messages: [...c.messages, assistantMessage],
              }
            : c
        )
      )

      if (returnedConvId !== convId) {
        setCurrentId(returnedConvId)
      }
    } catch (err) {
      setIsPseudoAnalyzing(false)
      setChatError(err instanceof Error ? err.message : 'Verbindungsfehler')
    } finally {
      setIsLoading(false)
      setStreamingContent('')
    }
  }, [currentId, conversations, selectedModel, selectedUseCase, useKnowledge, pseudoEnabled])

  const handleUseCaseChange = useCallback((useCase: string) => {
    setSelectedUseCase(useCase)
    if (currentId) {
      fetch('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentId, useCase }),
      })
      setConversations(prev =>
        prev.map(c => (c.id === currentId ? { ...c, useCase } : c))
      )
    }
  }, [currentId])

  const handleDeleteConversation = useCallback(async (id: string) => {
    await fetch('/api/conversations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setConversations(prev => prev.filter(c => c.id !== id))
    if (currentId === id) {
      setCurrentId(null)
      setLastPseudo(null)
      setStreamingContent('')
      setChatError(null)
    }
  }, [currentId])

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-main text-gray-400">
        Lade…
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-main">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        conversations={conversations}
        currentId={currentId}
        onSelectConversation={setCurrentId}
        onNewConversation={newConversation}
        onDeleteConversation={handleDeleteConversation}
        useKnowledge={useKnowledge}
        onToggleKnowledge={setUseKnowledge}
      />
      <ChatInterface
        conversation={currentConversation}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        selectedUseCase={selectedUseCase}
        useCases={useCases}
        onSelectUseCase={handleUseCaseChange}
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
