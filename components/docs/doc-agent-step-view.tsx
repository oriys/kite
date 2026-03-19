'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Bot,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  Wrench,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

interface AgentTask {
  id: string
  prompt: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  modelId: string | null
  result: string | null
  error: string | null
  steps: AgentStepRecord[]
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

const statusConfig: Record<string, { icon: typeof Clock; label: string; variant: 'secondary' | 'default' | 'outline' | 'destructive'; animate?: boolean }> = {
  pending: { icon: Clock, label: 'Pending', variant: 'secondary' },
  running: { icon: Loader2, label: 'Running', variant: 'default', animate: true },
  completed: { icon: CheckCircle2, label: 'Done', variant: 'outline' },
  failed: { icon: XCircle, label: 'Failed', variant: 'destructive' },
  cancelled: { icon: Ban, label: 'Cancelled', variant: 'secondary' },
}

// ─── Sub-components ─────────────────────────────────────────

function DetailStep({ step }: { step: AgentStepRecord }) {
  const [expanded, setExpanded] = React.useState(false)

  if (step.type === 'response') {
    return (
      <div className="flex gap-3 py-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/60">
          <MessageSquare className="size-3 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Response</p>
          <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{step.text}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-2">
      {(step.toolCalls ?? []).map((tc, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/60">
            <Wrench className="size-3 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-left"
            >
              {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              <span className="font-mono text-xs font-medium text-foreground">{tc.name}</span>
              {tc.error && (
                <Badge variant="destructive" className="text-[9px]">error</Badge>
              )}
            </button>
            {expanded && (
              <div className="mt-1.5 space-y-1.5 pl-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Arguments</p>
                  <pre className="mt-0.5 overflow-x-auto rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
                    {JSON.stringify(tc.args, null, 2)}
                  </pre>
                </div>
                {tc.result && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Result</p>
                    <pre className="mt-0.5 overflow-x-auto rounded-md bg-muted/30 p-2 text-[11px] text-muted-foreground">
                      {tc.result.length > 1000 ? tc.result.slice(0, 1000) + '…' : tc.result}
                    </pre>
                  </div>
                )}
                {tc.error && (
                  <p className="text-xs text-destructive">{tc.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

interface DocAgentStepViewProps {
  taskId: string
  onBack: () => void
  className?: string
}

export function DocAgentStepView({ taskId, onBack, className }: DocAgentStepViewProps) {
  const [task, setTask] = React.useState<AgentTask | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/ai/agent/${taskId}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setTask(data.task)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    // Poll while running
    const interval = setInterval(async () => {
      const res = await fetch(`/api/ai/agent/${taskId}`)
      if (res.ok && !cancelled) {
        const data = await res.json()
        setTask(data.task)
        if (data.task.status !== 'pending' && data.task.status !== 'running') {
          clearInterval(interval)
        }
      }
    }, 2000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [taskId])

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className={cn('px-4 py-8 text-center text-sm text-muted-foreground', className)}>
        Task not found.
      </div>
    )
  }

  const cfg = statusConfig[task.status]
  const StatusIcon = cfg.icon
  const steps = task.steps ?? []

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-7" onClick={onBack}>
            <ArrowLeft className="size-3.5" />
          </Button>
          <Bot className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Task Detail</span>
          <Badge variant={cfg.variant} className="gap-1 text-[10px]">
            <StatusIcon className={cn('size-3', cfg.animate && 'animate-spin')} />
            {cfg.label}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-foreground">{task.prompt}</p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
          {task.modelId && <span>{task.modelId}</span>}
          <span>{new Date(task.createdAt).toLocaleString()}</span>
          {task.completedAt && (
            <span>
              Duration: {Math.round((new Date(task.completedAt).getTime() - new Date(task.startedAt ?? task.createdAt).getTime()) / 1000)}s
            </span>
          )}
        </div>
      </div>

      {/* Steps timeline */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="divide-y divide-border/30 px-4">
          {steps.length === 0 && task.status === 'running' && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Agent is working…
            </div>
          )}
          {steps.map((step) => (
            <DetailStep key={step.index} step={step} />
          ))}
        </div>

        {/* Error */}
        {task.error && (
          <div className="mx-4 mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {task.error}
          </div>
        )}

        {/* Final result */}
        {task.status === 'completed' && task.result && (
          <div className="mx-4 mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Result</p>
            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{task.result}</p>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
