'use client'

import * as React from 'react'
import { Bot, Send, Square, Plus, FileText, Sparkles, Loader2, X } from 'lucide-react'

import { MarkdownPreview } from '@/components/docs/markdown-preview'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useAiChat, type ChatMessage } from '@/hooks/use-ai-chat'

interface AiChatPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId?: string
}

const MARKDOWN_HINT_RE =
  /(^#{1,6}\s)|(^>\s)|(^[-*+]\s)|(^\d+\.\s)|(```)|(\[[^\]]+\]\([^)]+\))|(^\|.+\|$)/m

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

  if (/^(SELECT|WITH|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/im.test(trimmed)) {
    return 'sql'
  }

  if (/<[A-Za-z][^>]*>/.test(trimmed) && /<\/[A-Za-z]/.test(trimmed)) {
    return 'html'
  }

  if (
    /^\s*(?:const|let|var|function|export|import|async\s+function|interface|type)\b/m.test(trimmed) ||
    /=>/.test(trimmed)
  ) {
    return 'ts'
  }

  if (
    /^\s*(?:def|class|import|from)\b/m.test(trimmed) &&
    /:\s*(?:#.*)?$/m.test(trimmed)
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

export function AiChatPanel({ open, onOpenChange, documentId }: AiChatPanelProps) {
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
  } = useAiChat({ documentId })

  const [input, setInput] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  // Focus input when panel opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSubmit = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!input.trim() || isStreaming) return
      sendMessage(input)
      setInput('')
    },
    [input, isStreaming, sendMessage],
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-accent" />
              AI Assistant
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={clearChat}
                title="New chat"
              >
                <Plus className="size-3.5" />
                New chat
              </Button>
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Close AI assistant"
                >
                  <X className="size-4" />
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-3 p-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isStreaming && messages[messages.length - 1]?.content === '' && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-4 mb-2 rounded-md border border-tone-error-subtle bg-tone-error-subtle/30 px-3 py-2 text-xs text-tone-error">
            {error}
          </div>
        )}

        {/* Input area */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your docs…"
              className="min-h-[40px] max-h-[120px] resize-none text-sm"
              rows={1}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={stopStreaming}
                title="Stop generating"
              >
                <Square className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                title="Send message"
              >
                <Send className="size-3.5" />
              </Button>
            )}
          </form>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            AI answers are grounded in your workspace documents
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Sub-components ─────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent/10">
        <Bot className="size-6 text-accent" />
      </div>
      <div>
        <p className="text-sm font-medium">Ask anything about your docs</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Answers are sourced from your workspace documents using RAG.
        </p>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const renderedAssistantContent = React.useMemo(
    () => normalizeAssistantContent(message.content),
    [message.content],
  )

  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[92%] overflow-hidden rounded-xl px-3 py-2.5 text-sm shadow-[0_1px_1px_rgba(15,23,42,0.04)]',
          isUser
            ? 'bg-accent text-accent-foreground'
            : 'border border-border/70 bg-card/90',
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words leading-6">{message.content || '\u00A0'}</div>
        ) : (
          <MarkdownPreview
            content={renderedAssistantContent}
            className={cn(
              'max-w-none text-[13px] leading-6 [overflow-wrap:anywhere]',
              '[&_.doc-json-viewer]:my-0 [&_.doc-schema-viewer]:my-0 [&_.doc-heatmap]:my-0',
              '[&_pre]:my-3 [&_pre]:border-border/70 [&_pre]:bg-background/80 [&_pre]:shadow-none',
              '[&_table]:text-[12.5px] [&_table]:leading-6',
              '[&_code]:break-words [&_blockquote]:text-foreground/75',
            )}
          />
        )}
      </div>

      {/* Source citations */}
      {message.sources && message.sources.length > 0 && (
        <div className="flex max-w-[92%] flex-wrap gap-1 px-1">
          {message.sources.map((source, i) => (
            <span
              key={source.chunkId}
              className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              title={source.preview}
            >
              <FileText className="size-2.5" />
              [{i + 1}] {source.title}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Floating trigger button ────────────────────────────────────

export function AiChatTrigger() {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden gap-2 border-border/60 bg-background/80 shadow-sm transition-colors hover:bg-muted/70 lg:inline-flex"
        onClick={() => setOpen(true)}
        title="Ask AI"
      >
        <Sparkles className="size-4" />
        Ask AI
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        title="Ask AI"
      >
        <Sparkles className="size-4" />
      </Button>
      <AiChatPanel open={open} onOpenChange={setOpen} />
    </>
  )
}
