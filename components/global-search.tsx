'use client'

import * as React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  ArrowUpRight,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Square,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MarkdownPreview } from '@/components/docs/markdown-preview'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  getDocEditorHref,
  getDocIdentifierFromEditorLocation,
  isDocumentIdLike,
} from '@/lib/documents'
import { sanitizeSearchHeadline } from '@/lib/sanitize'
import { cn } from '@/lib/utils'
import { useAiChat, type ChatMessage } from '@/hooks/use-ai-chat'

interface SearchResult {
  id: string
  title: string
  headline: string
  status: string
  updatedAt: string
  rank: number
  matchType?: 'keyword' | 'semantic' | 'hybrid'
  chunkPreview?: string
}

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SearchView = 'search' | 'ask'
type SearchFilter = 'all' | 'published' | 'review' | 'draft' | 'archived'

const ASK_EXAMPLES = [
  'How does authentication work for this API?',
  'What are the rate limits and how do I handle 429 errors?',
  'Walk me through the webhook payload structure.',
]

const SEARCH_SUGGESTIONS = [
  'authentication',
  'webhooks',
  'rate limits',
  'error codes',
]

const STATUS_STYLES: Record<string, string> = {
  draft: 'border-border/70 bg-muted/70 text-muted-foreground',
  review: 'border-tone-caution-border bg-tone-caution-bg text-tone-caution-text',
  published: 'border-tone-success-border bg-tone-success-bg text-tone-success-text',
  archived: 'border-border/70 bg-background/70 text-muted-foreground',
}

const FILTER_LABELS: Record<SearchFilter, string> = {
  all: 'All',
  published: 'Published',
  review: 'Review',
  draft: 'Draft',
  archived: 'Archived',
}

function formatStatusLabel(status: string) {
  if (status.length === 0) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function SearchResultCard({
  result,
  onSelect,
}: {
  result: SearchResult
  onSelect: (id: string) => void
}) {
  const snippet = sanitizeSearchHeadline(
    result.matchType === 'semantic' && result.chunkPreview
      ? result.chunkPreview
      : result.headline,
  )

  return (
    <button
      type="button"
      onClick={() => onSelect(result.id)}
      className="group w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <p className="truncate text-sm font-medium text-foreground">
              {result.title}
            </p>
            <span
              className={cn(
                'inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                STATUS_STYLES[result.status] ?? STATUS_STYLES.draft,
              )}
            >
              {formatStatusLabel(result.status)}
            </span>
            {result.matchType && result.matchType !== 'keyword' ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-accent-foreground">
                <Sparkles className="size-2.5" />
                {result.matchType === 'hybrid' ? 'hybrid' : 'semantic'}
              </span>
            ) : null}
          </div>

          {snippet ? (
            <p
              className="mt-1 line-clamp-2 pl-6 text-xs leading-5 text-muted-foreground [&_mark]:rounded-sm [&_mark]:bg-accent/50 [&_mark]:px-0.5 [&_mark]:text-accent-foreground"
              dangerouslySetInnerHTML={{ __html: snippet }}
            />
          ) : null}

          <p className="mt-0.5 pl-6 text-[11px] text-muted-foreground/60">
            {formatDistanceToNow(new Date(result.updatedAt), {
              addSuffix: true,
            })}
          </p>
        </div>

        <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40 transition group-hover:text-foreground" />
      </div>
    </button>
  )
}

/* ─── Inline chat message bubble ─── */
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted/60 text-foreground',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-wrapper min-w-0">
            <MarkdownPreview
              content={message.content}
              className={cn(
                'max-w-none text-[14px] leading-7 [overflow-wrap:anywhere]',
                '[&_p]:mb-4 [&_p:last-child]:mb-0',
                '[&_hr]:my-4 [&_hr]:border-border/50',
                '[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:tracking-tight',
                '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight',
                '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:tracking-tight',
                '[&_ul]:my-3 [&_ol]:my-3',
                '[&_li]:my-1',
                '[&_pre]:my-4 [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border/50 [&_pre]:bg-background/80',
                '[&_code]:rounded-sm [&_code]:bg-background/80 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]',
                '[&_table]:my-4 [&_table]:text-xs',
                '[&_th]:bg-background/80 [&_th]:text-foreground',
                '[&_td]:align-top',
                '[&_blockquote]:rounded-r-md [&_blockquote]:border-accent/40 [&_blockquote]:bg-background/60 [&_blockquote]:px-4 [&_blockquote]:py-1',
              )}
            />
          </div>
        )}
        {!isUser && message.sources && message.sources.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1 border-t border-border/30 pt-2">
            {message.sources.slice(0, 3).map((src) => (
              <span
                key={src.chunkId}
                className="inline-flex items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                <FileText className="size-2.5" />
                {src.title}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-lg border border-border/60 bg-muted/45 px-3 py-2.5">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="size-1.5 rounded-full bg-accent-foreground/75"
                animate={{
                  opacity: [0.3, 1, 0.3],
                  scale: [0.92, 1.15, 0.92],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: [0.16, 1, 0.3, 1],
                  delay: index * 0.16,
                }}
              />
            ))}
          </div>
          <span>Thinking</span>
        </div>

        <div className="mt-3 space-y-2">
          {['72%', '88%', '54%'].map((width, index) => (
            <motion.div
              key={width}
              className="h-2 rounded-full bg-gradient-to-r from-muted-foreground/10 via-muted-foreground/25 to-muted-foreground/10"
              style={{ width }}
              animate={{ opacity: [0.45, 0.9, 0.45] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: index * 0.14,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [view, setView] = React.useState<SearchView>('search')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [settledQuery, setSettledQuery] = React.useState('')
  const [activeFilter, setActiveFilter] = React.useState<SearchFilter>('all')
  const [askInput, setAskInput] = React.useState('')
  const abortRef = React.useRef<AbortController | null>(null)
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)
  const askInputRef = React.useRef<HTMLInputElement | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null)
  const routeDocumentIdentifier = React.useMemo(
    () => getDocIdentifierFromEditorLocation(pathname, searchParams),
    [pathname, searchParams],
  )
  const documentId = React.useMemo(
    () =>
      routeDocumentIdentifier && isDocumentIdLike(routeDocumentIdentifier)
        ? routeDocumentIdentifier
        : undefined,
    [routeDocumentIdentifier],
  )

  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearChat,
  } = useAiChat({ documentId })

  const trimmedSearchQuery = searchQuery.trim()
  const trimmedAskInput = askInput.trim()
  const isQueryDirty =
    trimmedSearchQuery.length > 0 && trimmedSearchQuery !== settledQuery

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      setView('search')
      setSearchQuery('')
      setResults([])
      setSettledQuery('')
      setIsLoading(false)
      setActiveFilter('all')
      setAskInput('')
      clearChat()
      return
    }

    const timer = window.setTimeout(() => {
      if (view === 'search') {
        searchInputRef.current?.focus()
      } else {
        askInputRef.current?.focus()
      }
    }, 40)

    return () => window.clearTimeout(timer)
  }, [open, view, clearChat])

  // Auto-scroll chat
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Debounced search
  React.useEffect(() => {
    if (!trimmedSearchQuery) {
      abortRef.current?.abort()
      setResults([])
      setSettledQuery('')
      setIsLoading(false)
      setActiveFilter('all')
      return
    }

    setIsLoading(true)

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const requestQuery = trimmedSearchQuery

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(requestQuery)}`,
          { signal: controller.signal },
        )

        if (!controller.signal.aborted && res.ok) {
          const data = (await res.json()) as { results: SearchResult[] }
          setResults(data.results)
          setSettledQuery(requestQuery)
        } else if (!controller.signal.aborted) {
          setResults([])
          setSettledQuery(requestQuery)
        }
      } catch (error) {
        if (!controller.signal.aborted && (error as Error).name !== 'AbortError') {
          setResults([])
          setSettledQuery(requestQuery)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }, 260)

    return () => {
      window.clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [trimmedSearchQuery])

  const filterCounts = React.useMemo(
    () => ({
      all: results.length,
      published: results.filter((r) => r.status === 'published').length,
      review: results.filter((r) => r.status === 'review').length,
      draft: results.filter((r) => r.status === 'draft').length,
      archived: results.filter((r) => r.status === 'archived').length,
    }),
    [results],
  )

  React.useEffect(() => {
    if (activeFilter !== 'all' && filterCounts[activeFilter] === 0) {
      setActiveFilter('all')
    }
  }, [activeFilter, filterCounts])

  const filteredResults = React.useMemo(() => {
    if (activeFilter === 'all') return results
    return results.filter((r) => r.status === activeFilter)
  }, [activeFilter, results])

  const handleSelectDocument = React.useCallback(
    (id: string) => {
      onOpenChange(false)
      window.location.href = getDocEditorHref(id)
    },
    [onOpenChange],
  )

  const switchToAsk = React.useCallback(
    (question?: string) => {
      setView('ask')
      if (question) {
        setAskInput('')
        sendMessage(question)
      }
      window.setTimeout(() => askInputRef.current?.focus(), 60)
    },
    [sendMessage],
  )

  const handleSearchInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return
      event.preventDefault()

      if (filteredResults.length > 0 && !isQueryDirty) {
        handleSelectDocument(filteredResults[0].id)
        return
      }

      if (trimmedSearchQuery) {
        switchToAsk(trimmedSearchQuery)
      }
    },
    [filteredResults, handleSelectDocument, isQueryDirty, switchToAsk, trimmedSearchQuery],
  )

  const handleAskSubmit = React.useCallback(() => {
    if (!trimmedAskInput || isStreaming) return
    const question = trimmedAskInput
    setAskInput('')
    sendMessage(question)
  }, [trimmedAskInput, isStreaming, sendMessage])

  const handleAskKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        handleAskSubmit()
      }
    },
    [handleAskSubmit],
  )

  const visibleFilters = (Object.keys(FILTER_LABELS) as SearchFilter[]).filter(
    (f) => f === 'all' || filterCounts[f] > 0,
  )
  const showSearchEmptyState =
    !isQueryDirty && settledQuery.length > 0 && filteredResults.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden border-border/60 bg-popover p-0 text-popover-foreground shadow-lg sm:max-w-[min(640px,96vw)]"
        showCloseButton={false}
        >
          <DialogTitle className="sr-only">Search or ask documentation</DialogTitle>
          <DialogDescription className="sr-only">
            Search workspace documents or ask AI using your knowledge base.
          </DialogDescription>

        <div className="relative flex h-[min(68vh,540px)] flex-col overflow-hidden">
          {/* Header with tabs */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Close search"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
            <div className="inline-flex rounded-lg border border-border/60 bg-muted/50 p-0.5">
              {([
                ['search', 'Search'],
                ['ask', 'Ask AI'],
              ] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition',
                    view === v
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
                ))}
              </div>
          </div>

          {/* ─── Search view ─── */}
          {view === 'search' ? (
            <>
              {/* Search input */}
              <div className="flex shrink-0 items-center gap-2.5 border-b border-border/60 px-4 py-2.5">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchInputKeyDown}
                  placeholder="Search endpoints, schemas, and guides…"
                  className="h-6 w-full bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground"
                />
                {isLoading ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : null}
              </div>

              {/* Search body */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {trimmedSearchQuery ? (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {/* Ask AI shortcut */}
                    <button
                      type="button"
                      onClick={() => switchToAsk(trimmedSearchQuery)}
                      className="flex shrink-0 items-center gap-2.5 border-b border-border/40 px-4 py-2.5 text-left transition hover:bg-muted/30"
                    >
                      <Sparkles className="size-3.5 shrink-0 text-accent-foreground" />
                      <span className="min-w-0 truncate text-sm text-foreground">
                        Ask AI about &ldquo;{trimmedSearchQuery}&rdquo;
                      </span>
                    </button>

                    {/* Filters */}
                    {results.length > 0 && visibleFilters.length > 2 ? (
                      <div className="flex shrink-0 gap-1 border-b border-border/40 px-4 py-2">
                        {visibleFilters.map((filter) => (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setActiveFilter(filter)}
                            className={cn(
                              'rounded-md px-2 py-1 text-xs transition',
                              activeFilter === filter
                                ? 'bg-muted text-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {FILTER_LABELS[filter]} ({filterCounts[filter]})
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {/* Results list */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
                      {isQueryDirty ? (
                        <div className="flex h-full items-center justify-center text-center">
                          <div>
                            <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                            <p className="mt-2 text-xs text-muted-foreground">Searching…</p>
                          </div>
                        </div>
                      ) : showSearchEmptyState ? (
                        <div className="flex h-full items-center justify-center px-4 text-center">
                          <div className="max-w-xs">
                            <p className="text-sm font-medium text-foreground">
                              No results for &ldquo;{settledQuery}&rdquo;
                            </p>
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              Try different keywords or ask AI to explain this topic.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => switchToAsk(settledQuery)}
                              className="mt-3"
                            >
                              <Sparkles className="mr-1.5 size-3" />
                              Ask AI instead
                            </Button>
                          </div>
                        </div>
                      ) : filteredResults.length > 0 ? (
                        <div>
                          {filteredResults.map((result) => (
                            <SearchResultCard
                              key={result.id}
                              result={result}
                              onSelect={handleSelectDocument}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  /* Empty state */
                  <div className="flex h-full flex-col justify-center px-6 py-8">
                    <p className="text-sm font-medium text-foreground">
                      Find endpoints, schemas, and guides across your workspace.
                    </p>
                    <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
                      Kite combines full-text and semantic search. Press Enter with no results to ask AI.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {SEARCH_SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSearchQuery(s)}
                          className="rounded-md border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:border-border hover:text-foreground"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ─── Ask AI view ─── */
            <>
              {/* Chat messages */}
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col justify-center">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-accent-foreground" />
                      <p className="text-sm font-medium text-foreground">
                        Ask about your API documentation
                      </p>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      Get answers grounded in your knowledge base — endpoints, schemas,
                      auth flows, and imported API materials in Kite.
                    </p>
                    <div className="mt-5 space-y-1">
                      {ASK_EXAMPLES.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            setAskInput('')
                            sendMessage(q)
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-muted/40"
                        >
                          <span className="text-sm text-foreground">{q}</span>
                          <ArrowUpRight className="size-3 shrink-0 text-muted-foreground/50" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <ChatBubble key={msg.id} message={msg} />
                    ))}
                    {isStreaming && messages[messages.length - 1]?.role !== 'assistant' ? (
                      <ThinkingBubble />
                    ) : null}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Ask input */}
              <div className="shrink-0 border-t border-border/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={askInputRef}
                    value={askInput}
                    onChange={(e) => setAskInput(e.target.value)}
                    onKeyDown={handleAskKeyDown}
                    placeholder="Ask a question…"
                    disabled={isStreaming}
                    className="h-8 w-full bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  {isStreaming ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={stopStreaming}
                      className="shrink-0"
                    >
                      <Square className="size-3" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={!trimmedAskInput}
                      onClick={handleAskSubmit}
                      className="shrink-0"
                    >
                      <Sparkles className="mr-1.5 size-3" />
                      Ask
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
