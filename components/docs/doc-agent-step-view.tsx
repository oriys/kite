'use client'

import * as React from 'react'
import { toast } from 'sonner'
import type {
  AgentInteraction,
  AgentStepRecord,
  AgentTaskProgress,
  AgentTaskStatus,
} from '@/lib/agent/shared'
import { DocAgentInteractionWidget } from '@/components/docs/doc-agent-interaction-widget'
import { DocAgentInteractivePage } from '@/components/docs/doc-agent-interactive-page'
import { MarkdownPreview } from '@/components/docs/markdown-preview'
import {
  createQueryMatchPlan,
  type QueryMatchPlan,
} from '@/lib/search/query-terms'
import { getDocAgentInteractivePagePreviewFromToolCall } from '@/lib/agent/interactive-page-templates'
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
  HelpCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface AgentTask {
  id: string
  prompt: string
  status: AgentTaskStatus
  modelId: string | null
  progress: AgentTaskProgress | null
  result: string | null
  error: string | null
  steps: AgentStepRecord[]
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  interaction: AgentInteraction | null
}

const statusConfig: Record<AgentTaskStatus, { icon: typeof Clock; label: string; variant: 'secondary' | 'default' | 'outline' | 'destructive'; animate?: boolean }> = {
  pending: { icon: Clock, label: 'Pending', variant: 'secondary' },
  running: { icon: Loader2, label: 'Running', variant: 'default', animate: true },
  waiting_for_input: { icon: HelpCircle, label: 'Needs input', variant: 'secondary' },
  completed: { icon: CheckCircle2, label: 'Done', variant: 'outline' },
  failed: { icon: XCircle, label: 'Failed', variant: 'destructive' },
  cancelled: { icon: Ban, label: 'Cancelled', variant: 'secondary' },
}

type AgentToolCall = NonNullable<AgentStepRecord['toolCalls']>[number]

const SEARCH_TERM_TOOL_NAMES = new Set([
  'search_documents',
  'search_knowledge_base',
])

function getSearchTermPlan(toolCall: AgentToolCall): QueryMatchPlan | null {
  if (!SEARCH_TERM_TOOL_NAMES.has(toolCall.name)) return null

  const query = typeof toolCall.args.query === 'string'
    ? toolCall.args.query.trim()
    : ''
  if (!query) return null

  const plan = createQueryMatchPlan(query)
  return plan.previewTerms.length > 0 ? plan : null
}

function SearchTermGroup({
  label,
  terms,
  tone = 'muted',
}: {
  label: string
  terms: string[]
  tone?: 'muted' | 'primary' | 'secondary'
}) {
  if (terms.length === 0) return null

  const toneClassName =
    tone === 'primary'
      ? 'border-blue-500/25 bg-blue-500/5 text-blue-700 dark:text-blue-300'
      : tone === 'secondary'
        ? 'border-border/60 bg-muted/35 text-muted-foreground'
        : 'border-border/70 bg-muted/20 text-foreground'

  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {terms.map((term) => (
          <Badge
            key={`${label}:${term}`}
            variant="outline"
            className={cn(
              'h-auto max-w-full whitespace-normal break-all px-1.5 py-0.5 text-[10px] font-normal',
              toneClassName,
            )}
          >
            {term}
          </Badge>
        ))}
      </div>
    </div>
  )
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
          {step.text ? (
            <MarkdownPreview
              content={step.text}
              className="mt-1 max-w-none text-sm leading-6"
            />
          ) : null}
        </div>
      </div>
    )
  }

  return (
      <div className="py-2">
        {(step.toolCalls ?? []).map((tc, i) => {
          const interactivePageArgs = getDocAgentInteractivePagePreviewFromToolCall(
            tc.name,
            tc.args,
          )
          const searchTermPlan = getSearchTermPlan(tc)

        return (
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
                  {interactivePageArgs ? (
                    <DocAgentInteractivePage
                      message={interactivePageArgs.message}
                      spec={interactivePageArgs.spec}
                      className="mb-2"
                    />
                  ) : null}
                  {searchTermPlan ? (
                    <div className="rounded-md border border-border/60 bg-muted/15 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Retrieval terms
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Query: <span className="text-foreground">{searchTermPlan.normalizedQuery}</span>
                      </p>
                      <div className="mt-2 space-y-2">
                        <SearchTermGroup
                          label="Exact"
                          terms={searchTermPlan.exactTerms}
                          tone="primary"
                        />
                        <SearchTermGroup
                          label="Primary"
                          terms={searchTermPlan.primaryTerms}
                          tone="muted"
                        />
                        <SearchTermGroup
                          label="Secondary"
                          terms={searchTermPlan.secondaryTerms}
                          tone="secondary"
                        />
                      </div>
                    </div>
                  ) : null}
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
        )
      })}
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

  const respond = React.useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/ai/agent/${taskId}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.message ?? 'Failed to send response')
        }

        setTask((current) =>
          current
            ? {
                ...current,
                interaction: null,
                status: 'running',
              }
            : current,
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send response'
        toast.error(message)
        throw err instanceof Error ? err : new Error(message)
      }
    },
    [taskId],
  )

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
        if (
          data.task.status !== 'pending'
          && data.task.status !== 'running'
          && data.task.status !== 'waiting_for_input'
        ) {
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
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {task.modelId && (
            <span className="max-w-[20rem] truncate">{task.modelId}</span>
          )}
          {task.progress && (
            <span>
              Steps: {task.progress.currentStep}/{task.progress.maxSteps}
            </span>
          )}
          <span>{new Date(task.createdAt).toLocaleString()}</span>
          {task.completedAt && (
            <span>
              Duration: {Math.round((new Date(task.completedAt).getTime() - new Date(task.startedAt ?? task.createdAt).getTime()) / 1000)}s
            </span>
          )}
        </div>
        {(task.status === 'pending' || task.status === 'running') && task.progress?.description && (
          <p className="mt-2 text-xs text-muted-foreground">
            {task.progress.description}
          </p>
        )}
      </div>

      {/* Steps timeline */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="divide-y divide-border/30 px-4">
          {steps.length === 0 && (task.status === 'running' || task.status === 'waiting_for_input') && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              {task.status === 'waiting_for_input' ? (
                <HelpCircle className="size-4 text-amber-500" />
              ) : (
                <Loader2 className="size-4 animate-spin" />
              )}
              {task.status === 'waiting_for_input'
                ? 'The agent is waiting for your input…'
                : 'Agent is working…'}
            </div>
          )}
          {steps.map((step) => (
            <DetailStep key={step.index} step={step} />
          ))}
        </div>

        {task.interaction && (
          <div className="mx-4 mt-4">
            <DocAgentInteractionWidget interaction={task.interaction} onRespond={respond} />
          </div>
        )}

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
            <MarkdownPreview
              content={task.result}
              className="mt-1 max-w-none text-sm leading-6"
            />
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
