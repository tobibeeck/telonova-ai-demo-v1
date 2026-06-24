'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { MODELS } from '@/lib/types'
import type { ModelId } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  selected: ModelId
  onChange: (m: ModelId) => void
}

export default function ModelSelector({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selectedModel = MODELS.find(m => m.id === selected)!

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors group"
      >
        <ModelDot model={selected} />
        <span className="text-sm font-semibold text-white">{selectedModel.name}</span>
        <span className="text-xs text-gray-400 bg-white/10 px-1.5 py-0.5 rounded-md">{selectedModel.badge}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-[#2f2f2f] rounded-xl border border-border shadow-xl z-50 overflow-hidden">
          <div className="p-1">
            {MODELS.map(model => (
              <button
                key={model.id}
                onClick={() => { onChange(model.id); setOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition-colors text-left group"
              >
                <ModelDot model={model.id} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{model.name}</span>
                    <span className="text-xs text-gray-500 bg-white/10 px-1.5 py-0.5 rounded">{model.badge}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-model-gpt" />
                    <span className="text-xs text-gray-500">EU-Datenschutz konform</span>
                  </div>
                </div>
                {selected === model.id && <Check className="w-4 h-4 text-model-gpt" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ModelDot({ model, size = 'sm' }: { model: ModelId; size?: 'sm' | 'lg' }) {
  const colors: Record<ModelId, string> = {
    gpt4: 'bg-model-gpt',
    claude: 'bg-model-claude',
    gemini: 'bg-model-gemini',
  }
  const dim = size === 'lg' ? 'w-9 h-9 text-base' : 'w-6 h-6 text-xs'
  const labels: Record<ModelId, string> = { gpt4: 'G', claude: 'C', gemini: 'G' }

  return (
    <div className={cn('rounded-lg flex items-center justify-center font-bold text-white', colors[model], dim)}>
      {labels[model]}
    </div>
  )
}
