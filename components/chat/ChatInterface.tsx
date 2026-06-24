'use client'

import Image from 'next/image'
import Link from 'next/link'
import { PanelLeft, AlertTriangle, X, ShieldOff } from 'lucide-react'
import ModelSelector from './ModelSelector'
import UseCaseSelector, { type UseCaseOption } from './UseCaseSelector'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import PseudoPanel from '@/components/pseudonymization/PseudoPanel'
import type { Conversation, ModelId, PseudonymizationResult } from '@/lib/types'

interface Props {
  conversation: Conversation | null
  selectedModel: ModelId
  onSelectModel: (m: ModelId) => void
  selectedUseCase: string
  useCases: UseCaseOption[]
  onSelectUseCase: (id: string) => void
  onSendMessage: (content: string) => void
  isLoading: boolean
  streamingContent: string
  pseudoResult: PseudonymizationResult | null
  isPseudoAnalyzing: boolean
  pseudoEnabled: boolean
  onTogglePseudo: (v: boolean) => void
  useKnowledge: boolean
  onToggleKnowledge: (v: boolean) => void
  onNewConversation: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  chatError: string | null
  onClearError: () => void
}

export default function ChatInterface({
  conversation,
  selectedModel,
  onSelectModel,
  selectedUseCase,
  useCases,
  onSelectUseCase,
  onSendMessage,
  isLoading,
  streamingContent,
  pseudoResult,
  isPseudoAnalyzing,
  pseudoEnabled,
  onTogglePseudo,
  useKnowledge,
  onToggleKnowledge,
  sidebarOpen,
  onToggleSidebar,
  chatError,
  onClearError,
}: Props) {
  const isEmpty = !conversation || conversation.messages.length === 0

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ModelSelector selected={selectedModel} onChange={onSelectModel} />
          {useCases.length > 0 && (
            <>
              <span className="text-gray-600">|</span>
              <UseCaseSelector
                selected={selectedUseCase}
                options={useCases}
                onChange={onSelectUseCase}
              />
            </>
          )}
        </div>
        <Link
          href="/audit"
          className="text-xs text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          API-Inspektion
        </Link>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-model-gpt/10 border border-model-gpt/20">
          <div className="w-1.5 h-1.5 rounded-full bg-model-gpt animate-pulse" />
          <span className="text-xs text-model-gpt font-medium">EU-Server</span>
        </div>
      </div>

      {!pseudoEnabled && (
        <div className="px-4 pt-3 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <ShieldOff className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <p className="text-xs text-yellow-300">
              Pseudonymisierung ist deaktiviert – unveränderte Daten werden an EU-Cloud-APIs gesendet.
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          <WelcomeScreen />
        ) : (
          <MessageList
            messages={conversation.messages}
            isLoading={isLoading}
            streamingContent={streamingContent}
            selectedModel={selectedModel}
            streamingReplacements={pseudoResult?.replacements}
          />
        )}
      </div>

      {pseudoEnabled && (isPseudoAnalyzing || (pseudoResult && pseudoResult.replacements.length > 0 && isLoading)) && (
        <PseudoPanel
          isAnalyzing={isPseudoAnalyzing}
          result={pseudoResult}
        />
      )}

      {chatError && (
        <div className="px-4 pb-2 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-400 mb-0.5">Verbindungsfehler</p>
              <p className="text-xs text-red-400/70 break-words">{chatError}</p>
            </div>
            <button onClick={onClearError} className="text-red-400/50 hover:text-red-400 transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <MessageInput
        onSend={onSendMessage}
        isLoading={isLoading}
        pseudoEnabled={pseudoEnabled}
        onTogglePseudo={onTogglePseudo}
        useKnowledge={useKnowledge}
        onToggleKnowledge={onToggleKnowledge}
      />
    </div>
  )
}

function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8">
      <div className="mb-6">
        <Image
          src="/images/telonova-logo.png"
          alt="teloNova AI"
          width={220}
          height={49}
          className="object-contain"
          priority
        />
      </div>
      <h1 className="text-2xl font-semibold text-white mb-3">Wie kann ich helfen?</h1>
      <p className="text-gray-400 text-sm text-center max-w-sm leading-relaxed">
        DSGVO-konformer KI-Assistent für Fachprofis im DACH-Raum.<br />
        Alle Eingaben werden vor der Übertragung lokal pseudonymisiert.
      </p>
    </div>
  )
}
