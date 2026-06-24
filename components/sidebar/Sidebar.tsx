'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, MessageSquare, ChevronLeft, Shield, Database, BookOpen, Eye, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Conversation } from '@/lib/types'
import KnowledgeUpload from './KnowledgeUpload'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  open: boolean
  onToggle: () => void
  conversations: Conversation[]
  currentId: string | null
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  onDeleteConversation: (id: string) => void
  useKnowledge: boolean
  onToggleKnowledge: (v: boolean) => void
}

export default function Sidebar({
  open,
  onToggle,
  conversations,
  currentId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  useKnowledge,
  onToggleKnowledge,
}: Props) {
  const [showKnowledge, setShowKnowledge] = useState(false)

  return (
    <>
      <AnimatePresence initial={false}>
        {open && (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-shrink-0 bg-sidebar h-screen flex flex-col overflow-hidden border-r border-border"
          >
            <div className="flex flex-col h-full w-[260px]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-4">
                <Image
                  src="/images/telonova-logo.png"
                  alt="teloNova AI"
                  width={140}
                  height={31}
                  className="object-contain"
                  priority
                />
                <button
                  onClick={onToggle}
                  className="p-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* New Chat */}
              <div className="px-3 pb-3">
                <button
                  onClick={onNewConversation}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 text-sm text-gray-300 hover:text-white transition-colors group"
                >
                  <Plus className="w-4 h-4" />
                  <span>Neuer Chat</span>
                </button>
              </div>

              {/* Conversations */}
              <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
                {conversations.length > 0 && (
                  <>
                    <p className="text-xs text-gray-500 px-2 py-2 uppercase tracking-wider">Verlauf</p>
                    {conversations.map(conv => (
                      <div
                        key={conv.id}
                        className={cn(
                          'flex items-center gap-1 rounded-lg group',
                          currentId === conv.id ? 'bg-white/15' : 'hover:bg-white/10'
                        )}
                      >
                        <button
                          onClick={() => onSelectConversation(conv.id)}
                          className={cn(
                            'flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors min-w-0',
                            currentId === conv.id ? 'text-white' : 'text-gray-400 group-hover:text-white'
                          )}
                        >
                          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                          <span className="truncate flex-1">{conv.title}</span>
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            onDeleteConversation(conv.id)
                          }}
                          className="p-1.5 mr-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all flex-shrink-0"
                          title="Chat löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Wissensdatenbank */}
              <div className="px-3 py-3 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span className="uppercase tracking-wider">Wissensdatenbank</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowKnowledge(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Dokumente verwalten</span>
                </button>
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-xs text-gray-500">Beim Chat nutzen</span>
                  <button
                    onClick={() => onToggleKnowledge(!useKnowledge)}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      useKnowledge ? 'bg-model-gpt' : 'bg-gray-600'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                        useKnowledge ? 'translate-x-4' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* DSGVO Badge */}
              <div className="px-3 py-3 border-t border-border space-y-2">
                <Link
                  href="/audit"
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>API-Inspektion</span>
                </Link>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-model-gpt/10 border border-model-gpt/20">
                  <Shield className="w-3.5 h-3.5 text-model-gpt flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-model-gpt">DSGVO-konform</p>
                    <p className="text-xs text-gray-500">EU-Server · Pseudonymisiert</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {showKnowledge && (
        <KnowledgeUpload onClose={() => setShowKnowledge(false)} />
      )}
    </>
  )
}
