'use client'

import * as React from 'react'
import { Bot, Send, Square, Plus, FileText, Sparkles, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
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
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-accent" />
              AI Assistant
            </SheetTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={clearChat}
                title="New chat"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-1 p-4">
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

  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-accent text-accent-foreground'
            : 'bg-muted/60',
        )}
      >
        <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {message.content || '\u00A0'}
        </div>
      </div>

      {/* Source citations */}
      {message.sources && message.sources.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {message.sources.map((source, i) => (
            <span
              key={source.chunkId}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
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
        variant="default"
        size="icon"
        className="fixed bottom-6 right-6 z-50 size-11 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        title="Ask AI"
      >
        <Sparkles className="size-5" />
      </Button>
      <AiChatPanel open={open} onOpenChange={setOpen} />
    </>
  )
}
