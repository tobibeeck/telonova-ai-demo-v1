'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Cpu, Lock } from 'lucide-react'
import type { PseudonymizationResult, PseudoReplacement } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  isAnalyzing: boolean
  result: PseudonymizationResult | null
}

const TYPE_CONFIG: Record<PseudoReplacement['type'], { label: string; color: string; bg: string }> = {
  PERSON:  { label: 'Person',       color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30' },
  DATUM:   { label: 'Datum',        color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' },
  TELEFON: { label: 'Telefon',      color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/30' },
  EMAIL:   { label: 'E-Mail',       color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' },
  IBAN:    { label: 'IBAN',         color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30' },
  ADRESSE: { label: 'Adresse',      color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30' },
  ORG:     { label: 'Organisation', color: 'text-cyan-400',   bg: 'bg-cyan-500/15 border-cyan-500/30' },
}

export default function PseudoPanel({ isAnalyzing, result }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: 8, height: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="border-t border-border bg-[#1a1a1a] overflow-hidden"
      >
        <div className="max-w-3xl mx-auto px-4 py-3">
          {isAnalyzing ? (
            <AnalyzingState />
          ) : result && result.replacements.length > 0 ? (
            <ResultState result={result} />
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function AnalyzingState() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-model-gpt/20 flex items-center justify-center flex-shrink-0">
        <Cpu className="w-3.5 h-3.5 text-model-gpt animate-pulse" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-white">Llama 3.2 analysiert lokale Daten…</p>
          <span className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">lokal · kein Upload</span>
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          {[0, 1, 2, 3, 4].map(i => (
            <motion.div
              key={i}
              className="h-1 rounded-full bg-model-gpt"
              animate={{ width: ['8px', '24px', '8px'] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ResultState({ result }: { result: PseudonymizationResult }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-model-gpt/20 flex items-center justify-center flex-shrink-0">
          <Lock className="w-3.5 h-3.5 text-model-gpt" />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-white">
            {result.replacements.length} personenbezogene Angabe{result.replacements.length !== 1 ? 'n' : ''} pseudonymisiert
          </p>
          <span className="text-xs text-gray-500">via Llama 3.2 (lokal)</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {result.replacements.map((r, i) => {
          const cfg = TYPE_CONFIG[r.type]
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs', cfg.bg)}
            >
              <span className={cn('font-mono font-medium', cfg.color)}>{r.token}</span>
              <span className="text-gray-500">→</span>
              <span className="text-gray-300 truncate max-w-[120px]">{r.original}</span>
              <span className={cn('text-[10px] opacity-70', cfg.color)}>{cfg.label}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
