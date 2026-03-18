'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  History,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Square,
  X,
  ArrowRight,
} from 'lucide-react'

import { MarkdownPreview } from '@/components/docs/markdown-preview'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useAiChat, type ChatMessage, type ChatSession } from '@/hooks/use-ai-chat'
import {
  formatChatSessionTimestamp,
  getChatSessionTitle,
  groupChatSessionsByDate,
  serializeChatTranscript,
} from '@/lib/ai-chat-ui'
import {
  getDocEditorHref,
  getDocIdentifierFromEditorLocation,
  isDocEditorPath,
  isDocumentIdLike,
} from '@/lib/documents'
import { cn } from '@/lib/utils'

interface AiChatPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId?: string
}

const MARKDOWN_HINT_RE =
  /(^#{1,6}\s)|(^>\s)|(^[-*+]\s)|(^\d+\.\s)|(```)|(\[[^\]]+\]\([^)]+\))|(^\|.+\|$)/m
const COMPOSER_MAX_HEIGHT = 220
const DESKTOP_MIN_WIDTH = 420
const DEFAULT_DRAWER_WIDTH = 560
const RESIZE_STEP = 24

function looksLikeJsonDocument(value: string) {
  if (!/^[\[{]/.test(value) || !/[\]}]$/.test(value)) {
    return false
  }

  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function detectCodeLanguage(value: string) {
  const trimmed = value.trim()
  const nonEmptyLines = trimmed.split('\n').filter((line) => line.trim().length > 0)

  if (nonEmptyLines.length < 2) {
    return null
  }

  if (/^(curl|pnpm|npm|yarn|git|npx|node|python3?|go|docker)\b/m.test(trimmed)) {
    return 'bash'
  }

  if (
    /^(SELECT|WITH|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/im.test(
      trimmed,
    )
  ) {
    return 'sql'
  }

  if (/<[A-Za-z][^>]*>/.test(trimmed) && /<\/[A-Za-z]/.test(trimmed)) {
    return 'html'
  }

  if (
    /^\s*(?:const|let|var|function|export|import|async\s+function|interface|type)\b/m.test(
      trimmed,
    )
    || /=>/.test(trimmed)
  ) {
    return 'ts'
  }

  if (
    /^\s*(?:def|class|import|from)\b/m.test(trimmed)
    && /:\s*(?:#.*)?$/m.test(trimmed)
  ) {
    return 'py'
  }

  return null
}

function normalizeAssistantContent(content: string) {
  const trimmed = content.trim()

  if (!trimmed || trimmed.includes('```')) {
    return content
  }

  if (looksLikeJsonDocument(trimmed)) {
    try {
      return `\`\`\`json\n${JSON.stringify(JSON.parse(trimmed), null, 2)}\n\`\`\``
    } catch {
      return content
    }
  }

  if (MARKDOWN_HINT_RE.test(trimmed)) {
    return content
  }

  const language = detectCodeLanguage(trimmed)
  if (!language) {
    return content
  }

  return `\`\`\`${language}\n${trimmed}\n\`\`\``
}

function clampDrawerWidth(nextWidth: number) {
  if (typeof window === 'undefined') {
    return nextWidth
  }

  const maxWidth = Math.max(DESKTOP_MIN_WIDTH, Math.floor(window.innerWidth * 0.5))
  return Math.min(Math.max(nextWidth, DESKTOP_MIN_WIDTH), maxWidth)
}

export function AiChatPanel({ open, onOpenChange, documentId }: AiChatPanelProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    sessionId,
    messages,
    sessions,
    isStreaming,
    isLoadingSessions,
    canResume,
    error,
    sessionsError,
    sendMessage,
    resumeReply,
    stopStreaming,
    clearChat,
    loadSession,
    refreshSessions,
  } = useAiChat({ documentId })

  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [input, setInput] = React.useState('')
  const [drawerWidth, setDrawerWidth] = React.useState(DEFAULT_DRAWER_WIDTH)
  const [pendingSessionId, setPendingSessionId] = React.useState<string | null>(null)
  const resizeStateRef = React.useRef<{ startX: number; startWidth: number } | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (!open) {
      setHistoryOpen(false)
      return
    }

    void refreshSessions()

    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 100)

    return () => window.clearTimeout(timer)
  }, [open, refreshSessions])

  React.useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return
    }

    const handleResize = () => {
      setDrawerWidth((current) => clampDrawerWidth(current))
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [open])

  React.useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const state = resizeStateRef.current
      if (!state) {
        return
      }

      setDrawerWidth(clampDrawerWidth(state.startWidth + (state.startX - event.clientX)))
    }

    const stopResize = () => {
      if (!resizeStateRef.current) {
        return
      }

      resizeStateRef.current = null
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResize)
      window.removeEventListener('pointercancel', stopResize)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
  }, [])

  React.useEffect(() => {
    const element = scrollRef.current
    if (!element) {
      return
    }

    element.scrollTo({ top: element.scrollHeight, behavior: 'auto' })
  }, [messages, open])

  React.useLayoutEffect(() => {
    const element = inputRef.current
    if (!element) {
      return
    }

    element.style.height = '0px'
    element.style.height = `${Math.min(element.scrollHeight, COMPOSER_MAX_HEIGHT)}px`
  }, [input, open])

  const currentEditorDocumentIdentifier = React.useMemo(
    () => getDocIdentifierFromEditorLocation(pathname, searchParams),
    [pathname, searchParams],
  )

  const activeSession = React.useMemo(
    () => sessions.find((session) => session.id === sessionId) ?? null,
    [sessionId, sessions],
  )
  const sessionGroups = React.useMemo(() => groupChatSessionsByDate(sessions), [sessions])
  const visibleMessages = React.useMemo(
    () => messages.filter((message) => message.role !== 'system' && message.content.trim().length > 0),
    [messages],
  )
  const transcriptValue = React.useMemo(
    () => serializeChatTranscript(visibleMessages),
    [visibleMessages],
  )

  const handleSourceSelect = React.useCallback(
    (source: NonNullable<ChatMessage['sources']>[number]) => {
      const targetDocumentIdentifier = source.documentSlug || source.documentId
      if (!targetDocumentIdentifier) {
        return
      }

      if (isDocEditorPath(pathname) && currentEditorDocumentIdentifier) {
        const translation = searchParams.get('translation')

        if (targetDocumentIdentifier === currentEditorDocumentIdentifier) {
          router.push(
            getDocEditorHref(currentEditorDocumentIdentifier, {
              translation,
            }),
            { scroll: false },
          )
          return
        }

        router.push(
          getDocEditorHref(currentEditorDocumentIdentifier, {
            translation,
            reference: targetDocumentIdentifier,
          }),
          { scroll: false },
        )
        return
      }

      router.push(getDocEditorHref(targetDocumentIdentifier))
    },
    [currentEditorDocumentIdentifier, pathname, router, searchParams],
  )

  const handleSubmit = React.useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault()
      if (!input.trim() || isStreaming) {
        return
      }

      void sendMessage(input)
      setInput('')
    },
    [input, isStreaming, sendMessage],
  )

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const handleNewChat = React.useCallback(() => {
    clearChat()
    setInput('')
    setHistoryOpen(false)
    setPendingSessionId(null)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [clearChat])

  const handleResume = React.useCallback(() => {
    void resumeReply()
  }, [resumeReply])

  const handleSessionSelect = React.useCallback(
    async (nextSessionId: string) => {
      setPendingSessionId(nextSessionId)
      await loadSession(nextSessionId)
      setPendingSessionId(null)
      setHistoryOpen(false)
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
      })
    },
    [loadSession],
  )

  const handleResizeStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (typeof window === 'undefined' || window.innerWidth < 640) {
        return
      }

      resizeStateRef.current = {
        startX: event.clientX,
        startWidth: drawerWidth,
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [drawerWidth],
  )

  const handleResizeKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return
      }

      event.preventDefault()
      setDrawerWidth((current) =>
        clampDrawerWidth(
          current + (event.key === 'ArrowLeft' ? RESIZE_STEP : -RESIZE_STEP),
        ),
      )
    },
    [],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        style={{ '--chat-panel-width': `${drawerWidth}px` } as React.CSSProperties}
        className="w-full gap-0 p-0 sm:w-[var(--chat-panel-width)] sm:max-w-[60vw]"
      >
        <SheetTitle className="sr-only">AI chat panel</SheetTitle>

        <div
          className="absolute inset-y-0 left-0 z-20 hidden w-3 translate-x-[-50%] cursor-col-resize items-center justify-center sm:flex"
          role="separator"
          aria-label="Resize chat panel"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={handleResizeStart}
          onKeyDown={handleResizeKeyDown}
        >
          <div className="h-16 w-0.5 rounded-sm bg-border/60 transition-all hover:bg-border" />
        </div>

        <div className="relative flex h-full min-h-0 flex-col bg-background font-sans">
          <header className="border-b border-border/40 px-4 py-3 bg-background">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-md hover:bg-muted/80"
                  onClick={() => setHistoryOpen((current) => !current)}
                >
                  <History className="size-[18px]" />
                </Button>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold tracking-tight text-foreground/90">
                    {activeSession ? getChatSessionTitle(activeSession.title) : 'Assistant'}
                  </h2>
                  {activeSession ? (
                    <p className="text-[10px] font-mono tracking-tight text-muted-foreground/70 uppercase">
                      {formatChatSessionTimestamp(activeSession.updatedAt)}
                    </p>
                  ) : (
                    <p className="text-[10px] font-mono tracking-tight text-muted-foreground/70 uppercase">
                      New Conversation
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <CopyButton
                  value={transcriptValue}
                  title="Copy conversation"
                  disabled={!transcriptValue}
                  className="size-8 rounded-md"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-md hover:bg-muted/80"
                  title="New chat"
                  onClick={handleNewChat}
                >
                  <Plus className="size-[18px]" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-md hover:bg-muted/80"
                  title="Close chat"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="size-[18px]" />
                </Button>
              </div>
            </div>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <AnimatePresence>
              {historyOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 bg-black/5"
                  onClick={() => setHistoryOpen(false)}
                />
              )}
            </AnimatePresence>

            <aside
              className={cn(
                'absolute inset-y-0 left-0 z-20 flex w-[min(340px,88%)] flex-col border-r border-border/40 bg-background transition-transform duration-300 ease-[0.16,1,0.3,1] sm:w-[min(340px,48%)]',
                historyOpen ? 'translate-x-0 shadow-lg shadow-black/5' : '-translate-x-full',
              )}
            >
              <div className="flex items-center justify-between border-b border-border/40 px-4 py-4">
                <p className="text-sm font-bold tracking-tight text-foreground/90">History</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  title="Close history"
                  onClick={() => setHistoryOpen(false)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
              </div>

              {sessionsError ? (
                <div className="px-4 py-3 text-xs text-tone-error-text bg-tone-error-bg/20 border-b border-tone-error-border/20">
                  {sessionsError}
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
                {isLoadingSessions && sessions.length === 0 ? (
                  <SessionListSkeleton />
                ) : sessionGroups.length > 0 ? (
                  <div className="space-y-6">
                    {sessionGroups.map((group) => (
                      <div key={group.label} className="space-y-2">
                        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                          {group.label}
                        </p>
                        <div className="space-y-0.5">
                          {group.sessions.map((session) => (
                            <SessionListItem
                              key={session.id}
                              active={session.id === sessionId}
                              pending={session.id === pendingSessionId}
                              session={session}
                              onSelect={handleSessionSelect}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-12 text-center">
                    <History className="mx-auto size-8 text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground/60">No conversations yet.</p>
                  </div>
                )}
              </div>
            </aside>

            <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-6 sm:px-6">
              <div className="mx-auto max-w-2xl w-full flex flex-col gap-8 pb-12">
                {visibleMessages.length === 0 ? (
                  <EmptyState />
                ) : (
                  <>
                    <AnimatePresence mode="popLayout" initial={false}>
                      {visibleMessages.map((message, index) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 12, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{
                            duration: 0.4,
                            ease: [0.16, 1, 0.3, 1],
                            delay: index === visibleMessages.length - 1 ? 0 : index * 0.05,
                          }}
                        >
                          <MessageItem
                            message={message}
                            onSourceSelect={handleSourceSelect}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {isStreaming && messages[messages.length - 1]?.content.trim() === '' ? (
                      <ThinkingIndicator />
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative border-t border-border/40 px-4 py-4 sm:px-6 bg-background">
            {error ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-md border border-tone-error-border/30 bg-tone-error-bg/20 px-4 py-2.5 text-[13px] text-tone-error-text"
              >
                {error}
              </motion.div>
            ) : null}

            <form
              onSubmit={handleSubmit}
              className="group relative rounded-lg border border-border/40 bg-card/60 p-2 ring-offset-background transition-colors focus-within:border-border/70 focus-within:bg-card/80"
            >
              <label htmlFor="ai-chat-input" className="sr-only">
                Ask the AI assistant
              </label>
              <Textarea
                id="ai-chat-input"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                className="min-h-[72px] max-h-[220px] resize-none border-0 bg-transparent px-3 py-2 text-[14px] leading-relaxed shadow-none hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0 placeholder:text-muted-foreground/40"
                rows={1}
                disabled={isStreaming}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />

              <div className="mt-1 flex items-center justify-end px-1 pb-1">
                <div className="flex items-center gap-2">
                  {canResume ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-md border-border/40 text-[13px] font-medium px-3 hover:bg-muted/40"
                      onClick={handleResume}
                    >
                      Continue
                    </Button>
                  ) : null}
                  {isStreaming ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 rounded-md border-border/40 p-0 hover:bg-muted/40"
                      onClick={stopStreaming}
                    >
                      <Square className="size-4 fill-foreground/20" />
                      <span className="sr-only">Stop</span>
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!input.trim()}
                      className="h-8 rounded-md text-[13px] font-medium px-3 disabled:opacity-30"
                    >
                      <Send className="size-4" />
                      Send
                    </Button>
                  )}
                </div>
              </div>
            </form>
            <p className="mt-3 text-center text-[10px] font-medium tracking-tight text-muted-foreground/50 uppercase">
              AI-generated content may be inaccurate
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-6 text-center">
      <Sparkles className="size-5 text-muted-foreground/30 mb-5" />
      <h3 className="text-sm font-semibold tracking-tight text-foreground/80 mb-1.5">
        Ask a question
      </h3>
      <p className="max-w-[280px] text-[13px] leading-relaxed text-muted-foreground/50 mb-8">
        Analyze documents, explain schemas, or draft technical content.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
        {[
          'Summarize this document',
          'Explain this endpoint',
          'Review for accuracy',
          'Draft a changelog',
        ].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="group flex items-center justify-between rounded-md border border-border/30 bg-card/40 px-3 py-2 text-[13px] text-foreground/70 transition-colors hover:bg-muted/30 hover:border-border/50"
          >
            <span>{suggestion}</span>
            <ArrowRight className="size-3 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageItem({
  message,
  onSourceSelect,
}: {
  message: ChatMessage
  onSourceSelect: (source: NonNullable<ChatMessage['sources']>[number]) => void
}) {
  const isUser = message.role === 'user'
  const renderedAssistantContent = React.useMemo(
    () => normalizeAssistantContent(message.content),
    [message.content],
  )

  if (isUser) {
    return (
      <article className="flex flex-col items-end gap-1.5">
        <span className="px-1 text-[10px] font-bold tracking-[0.15em] text-muted-foreground/50 uppercase">You</span>
        <div className="max-w-[90%] rounded-md bg-muted/20 border border-border/30 px-4 py-2.5 text-[14px] leading-relaxed text-foreground/90">
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
      </article>
    )
  }

  return (
    <article className="group flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground/50 uppercase">Assistant</span>
          {message.createdAt && (
            <span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums">
              {formatChatSessionTimestamp(message.createdAt)}
            </span>
          )}
        </div>
        <CopyButton
          value={message.content}
          title="Copy message"
          className="size-7 rounded-md opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        />
      </div>

      <div className="prose-wrapper min-w-0">
        <MarkdownPreview
          content={renderedAssistantContent}
          className={cn(
            'max-w-none text-[15px] leading-[1.8] [overflow-wrap:anywhere]',
            '[&_p]:mb-5 [&_p:last-child]:mb-0',
            '[&_.doc-json-viewer]:my-6 [&_.doc-schema-viewer]:my-6 [&_.doc-heatmap]:my-6',
            '[&_pre]:my-6 [&_pre]:border-border/40 [&_pre]:bg-muted/20 [&_pre]:shadow-none [&_pre]:rounded-md',
            '[&_table]:text-[13px] [&_table]:my-6',
            '[&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:bg-muted/40 [&_code]:text-[0.9em]',
            '[&_blockquote]:border-accent/30 [&_blockquote]:bg-accent/5 [&_blockquote]:py-1 [&_blockquote]:px-5 [&_blockquote]:rounded-r-md',
          )}
        />
      </div>

      {message.sources && message.sources.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-1 pt-3 border-t border-border/20">
          <p className="w-full text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mb-0.5">Sources</p>
          {message.sources.map((source, index) => (
            <button
              key={`${source.chunkId}:${source.documentId}:${index}`}
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-border/30 bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground"
              title={source.title}
              onClick={() => onSourceSelect(source)}
            >
              <span className="max-w-[120px] truncate">{source.title}</span>
              <span className="font-mono text-muted-foreground/40 tabular-nums">{index + 1}</span>
            </button>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="size-1.5 rounded-full bg-accent/40"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
      <span className="text-[11px] font-bold tracking-widest text-muted-foreground/40 uppercase animate-pulse">
        Thinking
      </span>
    </div>
  )
}

function SessionListItem({
  active,
  onSelect,
  pending,
  session,
}: {
  active: boolean
  onSelect: (sessionId: string) => void | Promise<void>
  pending: boolean
  session: ChatSession
}) {
  return (
    <button
      type="button"
      onClick={() => void onSelect(session.id)}
      className={cn(
        'group relative flex w-full flex-col items-start rounded-md px-3 py-2.5 text-left transition-colors',
        active
          ? 'bg-accent/8 text-foreground'
          : 'hover:bg-muted/50',
      )}
      aria-current={active ? 'true' : undefined}
    >
      <div className="flex w-full items-center gap-2">
        <span className={cn(
          "truncate text-[13px] font-semibold tracking-tight",
          active ? "text-accent-foreground" : "text-foreground/80"
        )}>
          {getChatSessionTitle(session.title)}
        </span>
        {pending ? (
          <Loader2 className="ml-auto size-3.5 animate-spin text-accent" />
        ) : (
          <ArrowRight className={cn(
            "ml-auto size-3 opacity-0 -translate-x-2 transition-all group-hover:opacity-40 group-hover:translate-x-0",
            active && "opacity-60 translate-x-0"
          )} />
        )}
      </div>
      <div className="mt-1 text-[9px] font-mono font-bold tracking-tight text-muted-foreground/50 uppercase">
        {formatChatSessionTimestamp(session.updatedAt)}
      </div>
      {active && (
        <motion.div
          layoutId="active-session-indicator"
          className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full bg-accent"
        />
      )}
    </button>
  )
}

function SessionListSkeleton() {
  return (
    <div className="space-y-8 px-1">
      {['Today', 'Older'].map((label) => (
        <div key={label} className="space-y-3">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">
            {label}
          </p>
          <div className="space-y-2">
            {[72, 54, 64].map((width, index) => (
              <div key={`${label}-${width}-${index}`} className="rounded-md bg-muted/20 px-3 py-3 animate-pulse">
                <div className="h-3.5 rounded-full bg-muted/40" style={{ width: `${width}%` }} />
                <div className="mt-2.5 h-2 w-20 rounded-full bg-muted/20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function AiChatTrigger() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = React.useState(false)

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

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Open chat"
        title="Open chat"
      >
        <Sparkles className="size-4" />
      </Button>
      <AiChatPanel open={open} onOpenChange={setOpen} documentId={documentId} />
    </>
  )
}
