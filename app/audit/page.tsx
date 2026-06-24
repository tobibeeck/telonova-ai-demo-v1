'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react'
import { MODELS } from '@/lib/types'
import type { ModelId, PseudoReplacement } from '@/lib/types'
import { cn } from '@/lib/utils'
import HighlightedPseudoText from '@/components/pseudonymization/HighlightedPseudoText'
import { getTypeColor } from '@/lib/highlight-pseudo'

interface AuditLog {
  id: string
  createdAt: string
  model: ModelId
  useCase: string
  pseudoEnabled: boolean
  originalUserMessage: string
  sentUserMessage: string
  replacements: PseudoReplacement[]
  replacementsCount: number
  piiDetected: boolean
  piiFindings: Array<{ type: string; text: string }>
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/audit')
      .then(r => r.json())
      .then(data => {
        setLogs(data.logs || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const modelName = (id: ModelId) => MODELS.find(m => m.id === id)?.name || id

  return (
    <div className="min-h-screen bg-main text-white">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zum Chat
          </Link>
          <Image
            src="/images/telonova-logo.png"
            alt="teloNova AI"
            width={120}
            height={27}
            className="object-contain hidden sm:block"
          />
        </div>
        <h1 className="text-lg font-semibold">API-Inspektion</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-sm text-gray-400 mb-6">
          Pro Nachricht: Was pseudonymisiert wurde und was tatsächlich an die Cloud-API ging.
        </p>

        {loading ? (
          <p className="text-gray-500 text-sm">Lade Audit-Logs…</p>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Noch keine API-Aufrufe protokolliert.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map(log => {
              const preview = log.originalUserMessage.slice(0, 80) + (log.originalUserMessage.length > 80 ? '…' : '')

              return (
                <div
                  key={log.id}
                  className="rounded-xl border border-border bg-[#1a1a1a] overflow-hidden"
                >
                  <button
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                  >
                    {log.piiDetected ? (
                      <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
                    ) : log.replacementsCount > 0 ? (
                      <ShieldCheck className="w-5 h-5 text-model-gpt flex-shrink-0" />
                    ) : (
                      <Shield className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white truncate max-w-[200px]">
                          {preview || 'Leere Nachricht'}
                        </span>
                        {log.replacementsCount > 0 && (
                          <span className="text-xs bg-model-gpt/20 text-model-gpt px-1.5 py-0.5 rounded">
                            {log.replacementsCount} pseudonymisiert
                          </span>
                        )}
                        {log.piiDetected && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                            PII-Warnung
                          </span>
                        )}
                        {!log.pseudoEnabled && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
                            Pseudo AUS
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(log.createdAt).toLocaleString('de-DE')} · {modelName(log.model)}
                      </p>
                    </div>
                    {expanded === log.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {expanded === log.id && (
                    <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                      {log.piiDetected && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                          <p className="text-xs font-medium text-red-400 mb-2">
                            PII im API-Payload erkannt
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {log.piiFindings.map((f, i) => (
                              <span key={i} className="text-xs bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-300">
                                {f.type}: {f.text}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {log.replacementsCount === 0 ? (
                        <p className="text-sm text-gray-400">
                          {log.pseudoEnabled
                            ? 'Keine personenbezogenen Daten erkannt – nichts pseudonymisiert.'
                            : 'Pseudonymisierung war deaktiviert – Originaltext ging an die API.'}
                        </p>
                      ) : (
                        <>
                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                              Dein Text (Original)
                            </p>
                            <div className="rounded-lg bg-white/5 border border-border p-3 text-sm">
                              <HighlightedPseudoText
                                text={log.originalUserMessage}
                                replacements={log.replacements}
                                mode="outgoing"
                              />
                            </div>
                          </div>

                          <div className="flex justify-center">
                            <ArrowRight className="w-4 h-4 text-gray-600" />
                          </div>

                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                              An API gesendet
                            </p>
                            <div className="rounded-lg bg-model-gpt/5 border border-model-gpt/20 p-3 text-sm">
                              <HighlightedPseudoText
                                text={log.sentUserMessage}
                                replacements={log.replacements}
                                mode="tokens"
                              />
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                              Ersetzungen
                            </p>
                            <div className="space-y-1.5">
                              {log.replacements.map((r, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    'flex items-center gap-2 text-xs px-3 py-2 rounded-lg border',
                                    getTypeColor(r.type)
                                  )}
                                >
                                  <span className="font-mono">{r.original}</span>
                                  <ArrowRight className="w-3 h-3 opacity-50" />
                                  <span className="font-mono">{r.token}</span>
                                  <span className="opacity-60 ml-auto">{r.type}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
