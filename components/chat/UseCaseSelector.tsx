'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UseCaseOption {
  id: string
  label: string
}

interface Props {
  selected: string
  options: UseCaseOption[]
  onChange: (id: string) => void
}

export default function UseCaseSelector({ selected, options, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selectedOption = options.find(o => o.id === selected) || options[0]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!selectedOption) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors"
      >
        <span className="text-sm text-gray-300">{selectedOption.label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[#2f2f2f] rounded-xl border border-border shadow-xl z-50 overflow-hidden">
          <div className="p-1">
            {options.map(option => (
              <button
                key={option.id}
                onClick={() => { onChange(option.id); setOpen(false) }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors text-left"
              >
                <span className="text-sm text-white">{option.label}</span>
                {selected === option.id && <Check className="w-4 h-4 text-model-gpt" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
