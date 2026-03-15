'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { ChevronUp, ChevronDown, X, Replace, CaseSensitive } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocFindReplaceProps {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DocFindReplace({ editor, open, onOpenChange }: DocFindReplaceProps) {
  const [showReplace, setShowReplace] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const wasOpenRef = React.useRef(open)

  const storage = (editor.storage as unknown as Record<string, unknown>).searchReplace as {
    searchTerm: string
    replaceTerm: string
    caseSensitive: boolean
    results: { from: number; to: number }[]
    currentIndex: number
  }

  const [searchTerm, setSearchTerm] = React.useState(storage.searchTerm)
  const [replaceTerm, setReplaceTerm] = React.useState(storage.replaceTerm)
  const [caseSensitive, setCaseSensitive] = React.useState(storage.caseSensitive)
  const resultCount = storage.results.length
  const currentIndex = storage.currentIndex

  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchInputRef.current?.focus())
    } else if (wasOpenRef.current) {
      editor.commands.clearSearch()
      setSearchTerm('')
      setReplaceTerm('')
    }

    wasOpenRef.current = open
  }, [open, editor])

  const handleSearchChange = React.useCallback(
    (value: string) => {
      setSearchTerm(value)
      editor.commands.setSearchTerm(value)
    },
    [editor],
  )

  const handleReplaceChange = React.useCallback(
    (value: string) => {
      setReplaceTerm(value)
      editor.commands.setReplaceTerm(value)
    },
    [editor],
  )

  const handleToggleCase = React.useCallback(() => {
    const next = !caseSensitive
    setCaseSensitive(next)
    editor.commands.setCaseSensitive(next)
  }, [caseSensitive, editor])

  const handleClose = React.useCallback(() => {
    onOpenChange(false)
    editor.commands.focus()
  }, [onOpenChange, editor])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) {
          editor.commands.goToPrevMatch()
        } else {
          editor.commands.goToNextMatch()
        }
      } else if (e.key === 'F' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
      }
    },
    [editor, handleClose],
  )

  if (!open) return null

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur-sm',
        'motion-safe:animate-in motion-safe:slide-in-from-top-1 motion-safe:fade-in motion-safe:duration-150',
      )}
      role="search"
      aria-label="Find and replace"
      onKeyDown={handleKeyDown}
    >
      {/* Search row */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Find…"
            className="h-7 pr-16 text-sm"
            aria-label="Search text"
          />
          {searchTerm && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground">
              {resultCount > 0 ? `${currentIndex + 1}/${resultCount}` : 'No results'}
            </span>
          )}
        </div>

        <Toggle
          size="sm"
          pressed={caseSensitive}
          onPressedChange={handleToggleCase}
          aria-label="Case sensitive"
          className="h-7 w-7 shrink-0"
        >
          <CaseSensitive className="size-3.5" />
        </Toggle>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.commands.goToPrevMatch()}
          disabled={resultCount === 0}
          aria-label="Previous match"
          className="h-7 w-7 shrink-0"
        >
          <ChevronUp className="size-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.commands.goToNextMatch()}
          disabled={resultCount === 0}
          aria-label="Next match"
          className="h-7 w-7 shrink-0"
        >
          <ChevronDown className="size-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowReplace((v) => !v)}
          aria-label="Toggle replace"
          aria-expanded={showReplace}
          className="h-7 w-7 shrink-0"
        >
          <Replace className="size-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleClose}
          aria-label="Close find"
          className="h-7 w-7 shrink-0"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div className="flex items-center gap-1.5 motion-safe:animate-in motion-safe:slide-in-from-top-0.5 motion-safe:fade-in motion-safe:duration-100">
          <Input
            value={replaceTerm}
            onChange={(e) => handleReplaceChange(e.target.value)}
            placeholder="Replace…"
            className="h-7 flex-1 text-sm"
            aria-label="Replace text"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.commands.replaceCurrent()}
            disabled={resultCount === 0}
            className="h-7 shrink-0 px-2 text-xs"
          >
            Replace
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.commands.replaceAll()}
            disabled={resultCount === 0}
            className="h-7 shrink-0 px-2 text-xs"
          >
            All
          </Button>
        </div>
      )}
    </div>
  )
}
