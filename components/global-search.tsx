'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { FileText, Search, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface SearchResult {
  id: string
  title: string
  headline: string
  status: string
  updatedAt: string
  rank: number
}

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'border-border bg-muted/60 text-muted-foreground',
  review: 'border-[oklch(0.84_0.08_83)] bg-[oklch(0.78_0.12_83/0.10)] text-[oklch(0.48_0.10_83)]',
  published: 'border-[oklch(0.84_0.08_145)] bg-[oklch(0.62_0.11_145/0.10)] text-[oklch(0.42_0.10_145)]',
  archived: 'border-border bg-muted/40 text-muted-foreground/70',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        STATUS_STYLES[status] ?? STATUS_STYLES.draft,
      )}
    >
      {status}
    </span>
  )
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setHasSearched(false)
      setIsLoading(false)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsLoading(true)
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        )
        if (res.ok) {
          const data = await res.json()
          setResults(data.results)
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResults([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
          setHasSearched(true)
        }
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [query])

  const handleSelect = useCallback(
    (id: string) => {
      onOpenChange(false)
      window.location.href = `/docs/editor?id=${id}`
    },
    [onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search documents</DialogTitle>
        <DialogDescription>
          Full-text search across all workspace documents
        </DialogDescription>
      </DialogHeader>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-[560px]"
        showCloseButton={false}
      >
        <CommandPrimitive
          className="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground"
          shouldFilter={false}
        >
          {/* Search input */}
          <div className="flex h-12 items-center gap-2 border-b px-3">
            {isLoading ? (
              <Loader2 className="size-4 shrink-0 animate-spin opacity-50" />
            ) : (
              <Search className="size-4 shrink-0 opacity-50" />
            )}
            <CommandPrimitive.Input
              placeholder="Search documents…"
              value={query}
              onValueChange={setQuery}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Results list */}
          <CommandPrimitive.List className="max-h-[360px] scroll-py-1 overflow-x-hidden overflow-y-auto">
            {hasSearched && results.length === 0 && !isLoading && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No documents found for &ldquo;{query}&rdquo;
              </div>
            )}

            {results.length > 0 && (
              <CommandPrimitive.Group
                heading="Documents"
                className="overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {results.map((result) => (
                  <CommandPrimitive.Item
                    key={result.id}
                    value={result.id}
                    onSelect={() => handleSelect(result.id)}
                    className="group relative flex cursor-default items-start gap-3 rounded-sm px-2 py-2.5 text-sm outline-hidden select-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  >
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {result.title}
                        </span>
                        <StatusBadge status={result.status} />
                      </div>

                      {result.headline && (
                        <p
                          className="line-clamp-2 text-xs leading-relaxed text-muted-foreground [&_mark]:rounded-sm [&_mark]:bg-[oklch(0.946_0.015_244)] [&_mark]:px-0.5 [&_mark]:text-[oklch(0.314_0.017_244)] dark:[&_mark]:bg-[oklch(0.35_0.04_244)] dark:[&_mark]:text-[oklch(0.82_0.04_244)]"
                          dangerouslySetInnerHTML={{ __html: result.headline }}
                        />
                      )}

                      <p className="text-[11px] text-muted-foreground/70">
                        Updated{' '}
                        {formatDistanceToNow(new Date(result.updatedAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}

            {!hasSearched && !isLoading && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Type to search across all documents
              </div>
            )}
          </CommandPrimitive.List>

          {/* Footer hint */}
          <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground/70">
            <span>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                ↑↓
              </kbd>{' '}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                ↵
              </kbd>{' '}
              open
            </span>
            <span>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                esc
              </kbd>{' '}
              close
            </span>
          </div>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  )
}
