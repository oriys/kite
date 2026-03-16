'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

interface DocSourceAutocompleteOverlayProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  cursorOffset: number
  suggestion: string
  className?: string
  contentClassName?: string
}

export function DocSourceAutocompleteOverlay({
  textareaRef,
  value,
  cursorOffset,
  suggestion,
  className,
  contentClassName,
}: DocSourceAutocompleteOverlayProps) {
  const overlayRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const textarea = textareaRef.current
    const overlay = overlayRef.current
    if (!textarea || !overlay) return

    const syncScroll = () => {
      overlay.scrollTop = textarea.scrollTop
      overlay.scrollLeft = textarea.scrollLeft
    }

    syncScroll()
    textarea.addEventListener('scroll', syncScroll)
    return () => textarea.removeEventListener('scroll', syncScroll)
  }, [textareaRef])

  if (!suggestion) return null

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words',
        className,
      )}
    >
      <div
        className={cn(
          'min-h-full font-mono text-[13px] leading-7',
          contentClassName ?? 'p-4 md:p-6',
        )}
      >
        <span className="text-transparent">{value.slice(0, cursorOffset)}</span>
        <span className="select-none text-foreground/30">{suggestion}</span>
      </div>
    </div>
  )
}
