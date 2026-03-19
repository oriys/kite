'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Bot,
  Send,
  Square,
  ChevronDown,
  ChevronRight,
  Wrench,
  MessageSquare,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

// ─── Types ──────────────────────────────────────────────────

interface AgentStepRecord {
  index: number
  type: 'tool_call' | 'response'
  toolCalls?: Array<{
    name: string
    args: Record<string, unknown>
    result?: string
    error?: string
  }>
  text?: string
}

interface AgentProgress {
  currentStep: number
  maxSteps: number
  description?: string
}

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

// ─── Hook: useAgentTask ─────────────────────────────────────

function useAgentTask() {
  const [steps, setSteps] = React.useState<AgentStepRecord[]>([])
  const [status, setStatus] = React.useState<TaskStatus | null>(null)
  const [progress, setProgress] = React.useState<AgentProgress | null>(null)
  const [result, setResult] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [taskId, setTaskId] = React.useState<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  const reset = React.useCallback(() => {
    setSteps([])
    setStatus(null)
    setProgress(null)
    setResult(null)
    setError(null)
    setTaskId(null)
  }, [])

  const run = React.useCallback(async (prompt: string, documentId?: string) => {
    reset()
    setStatus('pending')

    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, documentId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message ?? `Failed to create task (${res.status})`)
      }

      const { task } = await res.json()
      setTaskId(task.id)
      setStatus('running')

      // Connect to SSE stream
      const controller = new AbortController()
      abortRef.current = controller

      const sse = await fetch(`/api/ai/agent/${task.id}/stream`, {
        signal: controller.signal,
      })

      if (!sse.ok || !sse.body) throw new Error('Failed to connect to stream')

      const reader = sse.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6))
              switch (currentEvent) {
                case 'step':
                  setSteps((prev) => [...prev, data as AgentStepRecord])
                  break
                case 'progress':
                  setProgress(data as AgentProgress)
                  break
                case 'done':
                  setResult(data.result)
                  setStatus('completed')
                  break
                case 'error':
                  setError(data.message)
                  setStatus('failed')
                  break
                case 'cancelled':
                  setStatus('cancelled')
                  break
              }
            } catch { /* skip malformed data */ }
            currentEvent = ''
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus('cancelled')
        return
      }
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      setStatus('failed')
    }
  }, [reset])

  const cancel = React.useCallback(async () => {
    abortRef.current?.abort()
    if (taskId) {
      await fetch(`/api/ai/agent/${taskId}/cancel`, { method: 'POST' }).catch(() => {})
    }
    setStatus('cancelled')
  }, [taskId])

  return { steps, status, progress, result, error, taskId, run, cancel, reset }
}

// ─── Sub-components ─────────────────────────────────────────

function StatusBadge({ status }: { status: TaskStatus }) {
  const config: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ReactNode }> = {
    pending: { label: 'Pending', variant: 'secondary', icon: <Clock className="size-3" /> },
    running: { label: 'Running', variant: 'default', icon: <Loader2 className="size-3 animate-spin" /> },
    completed: { label: 'Done', variant: 'outline', icon: <CheckCircle2 className="size-3 text-emerald-500" /> },
    failed: { label: 'Failed', variant: 'destructive', icon: <XCircle className="size-3" /> },
    cancelled: { label: 'Cancelled', variant: 'secondary', icon: <Square className="size-3" /> },
  }
  const c = config[status]
  return (
    <Badge variant={c.variant} className="gap-1 text-[10px]">
      {c.icon}
      {c.label}
    </Badge>
  )
}

function StepItem({ step }: { step: AgentStepRecord }) {
  const [expanded, setExpanded] = React.useState(false)

  if (step.type === 'response') {
    return (
      <div className="flex gap-2 py-1.5">
        <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-sm text-foreground whitespace-pre-wrap">{step.text}</p>
      </div>
    )
  }

  const calls = step.toolCalls ?? []
  return (
    <div className="py-1.5">
      {calls.map((tc, i) => (
        <div key={i} className="group">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm hover:bg-muted/50"
          >
            {expanded ? (
              <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
            )}
            <Wrench className="size-3 shrink-0 text-muted-foreground" />
            <span className="font-mono text-xs text-muted-foreground">{tc.name}</span>
            {tc.error && <XCircle className="size-3 shrink-0 text-destructive" />}
          </button>
          {expanded && (
            <div className="ml-6 mt-1 space-y-1">
              <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[11px] text-muted-foreground">
                {JSON.stringify(tc.args, null, 2)}
              </pre>
              {tc.result && (
                <pre className="overflow-x-auto rounded bg-muted/30 p-2 text-[11px] text-muted-foreground">
                  {tc.result.length > 500 ? tc.result.slice(0, 500) + '…' : tc.result}
                </pre>
              )}
              {tc.error && (
                <p className="text-xs text-destructive">{tc.error}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main Panel ─────────────────────────────────────────────

interface DocAgentPanelProps {
  documentId?: string
  onClose?: () => void
  className?: string
}

export function DocAgentPanel({ documentId, onClose, className }: DocAgentPanelProps) {
  const { steps, status, progress, result, error, run, cancel, reset } = useAgentTask()
  const [input, setInput] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const isActive = status === 'pending' || status === 'running'

  // Auto-scroll to bottom on new steps
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [steps.length])

  const handleSubmit = () => {
    const prompt = input.trim()
    if (!prompt || isActive) return
    setInput('')
    run(prompt, documentId).catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Agent failed')
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <aside className={cn('flex h-full flex-col border-l border-border/60 bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Doc Agent</span>
          {status && <StatusBadge status={status} />}
        </div>
        <div className="flex items-center gap-1">
          {isActive && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancel}>
              Cancel
            </Button>
          )}
          {status && !isActive && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reset}>
              Clear
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
              ×
            </Button>
          )}
        </div>
      </div>

      {/* Steps */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="space-y-0.5 px-4 py-3">
          {steps.length === 0 && !status && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="mb-3 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Ask the agent to create, update, or review documents.
              </p>
            </div>
          )}

          {steps.map((step) => (
            <StepItem key={step.index} step={step} />
          ))}

          {/* Progress indicator */}
          {isActive && progress?.description && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {progress.description}
              <span className="tabular-nums">
                ({progress.currentStep}/{progress.maxSteps})
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Final result */}
          {status === 'completed' && result && steps[steps.length - 1]?.type !== 'response' && (
            <div className="flex gap-2 border-t border-border/40 pt-3">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
              <p className="text-sm text-foreground whitespace-pre-wrap">{result}</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border/60 p-3">
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent to do something…"
            disabled={isActive}
            className="min-h-[60px] resize-none pr-10 text-sm"
            rows={2}
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute bottom-1.5 right-1.5 size-7"
            onClick={handleSubmit}
            disabled={isActive || !input.trim()}
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
