'use client'

import { List, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type OutlineHeading } from '@/hooks/use-doc-outline'
import { Button } from '@/components/ui/button'

interface DocOutlineProps {
  headings: OutlineHeading[]
  activeId: string | null
  onSelect: (heading: OutlineHeading) => void
  onClose: () => void
}

const LEVEL_INDENT: Record<number, string> = {
  1: 'pl-0',
  2: 'pl-3.5',
  3: 'pl-7',
}

export function DocOutline({ headings, activeId, onSelect, onClose }: DocOutlineProps) {
  if (headings.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <List className="size-3.5" />
            Outline
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close outline">
            <X className="size-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground/70">
          No headings yet. Use heading styles to build an outline.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 p-3">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <List className="size-3.5" />
          Outline
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close outline">
          <X className="size-3.5" />
        </Button>
      </div>
      <nav aria-label="Document outline">
        <ul className="flex flex-col gap-px">
          {headings.map((heading) => (
            <li key={heading.id}>
              <button
                type="button"
                onClick={() => onSelect(heading)}
                className={cn(
                  'group flex w-full items-center rounded-sm px-2 py-1 text-left text-[13px] leading-snug transition-colors',
                  LEVEL_INDENT[heading.level] ?? 'pl-0',
                  activeId === heading.id
                    ? 'bg-accent/60 font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <span className="truncate">{heading.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
