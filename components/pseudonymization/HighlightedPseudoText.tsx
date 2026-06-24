'use client'

import type { PseudoReplacement } from '@/lib/types'
import { buildHighlightedSegments, getTypeColor } from '@/lib/highlight-pseudo'
import { cn } from '@/lib/utils'

interface Props {
  text: string
  replacements?: PseudoReplacement[]
  mode: 'outgoing' | 'incoming' | 'tokens'
  className?: string
}

export default function HighlightedPseudoText({ text, replacements = [], mode, className }: Props) {
  const segments = buildHighlightedSegments(text, replacements, mode)

  return (
    <span className={cn('whitespace-pre-wrap leading-relaxed', className)}>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            title={seg.title}
            className={cn(
              'rounded px-0.5 border font-medium not-italic',
              getTypeColor(seg.highlight)
            )}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  )
}
