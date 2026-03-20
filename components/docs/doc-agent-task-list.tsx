'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { AgentTaskProgress, AgentTaskStatus } from '@/lib/agent/shared'
import {
  Bot,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  ChevronRight,
  HelpCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

// ─── Types ──────────────────────────────────────────────────

interface AgentTask {
  id: string
  prompt: string
  status: AgentTaskStatus
  modelId: string | null
  progress: AgentTaskProgress | null
  documentId: string | null
  createdAt: string
  completedAt: string | null
  result: string | null
  error: string | null
}

// ─── Sub-components ─────────────────────────────────────────

const statusConfig: Record<AgentTaskStatus, { icon: typeof Clock; label: string; variant: 'secondary' | 'default' | 'outline' | 'destructive'; color: string; animate?: boolean }> = {
  pending: { icon: Clock, label: 'Pending', variant: 'secondary', color: 'text-muted-foreground' },
  running: { icon: Loader2, label: 'Running', variant: 'default', color: 'text-blue-500', animate: true },
  waiting_for_input: { icon: HelpCircle, label: 'Needs input', variant: 'secondary', color: 'text-amber-500' },
  completed: { icon: CheckCircle2, label: 'Done', variant: 'outline', color: 'text-emerald-500' },
  failed: { icon: XCircle, label: 'Failed', variant: 'destructive', color: 'text-destructive' },
  cancelled: { icon: Ban, label: 'Cancelled', variant: 'secondary', color: 'text-muted-foreground' },
}

function TaskRow({ task, onSelect }: { task: AgentTask; onSelect: (id: string) => void }) {
  const cfg = statusConfig[task.status]
  const Icon = cfg.icon
  const age = formatAge(task.createdAt)

  return (
    <button
      onClick={() => onSelect(task.id)}
      className="group flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-muted/30 last:border-0"
    >
      <Icon className={cn('size-4 shrink-0', cfg.color, cfg.animate && 'animate-spin')} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {task.prompt.length > 80 ? task.prompt.slice(0, 80) + '…' : task.prompt}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{age}</span>
          {task.modelId && (
            <span className="max-w-[16rem] truncate text-[11px] text-muted-foreground/70">
              {task.modelId}
            </span>
          )}
          {task.progress && (
            <span className="text-[11px] text-muted-foreground/70">
              {task.progress.currentStep}/{task.progress.maxSteps} steps
            </span>
          )}
        </div>
      </div>
      <Badge variant={cfg.variant} className="shrink-0 text-[10px]">{cfg.label}</Badge>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

function formatAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ─── Main Component ─────────────────────────────────────────

interface DocAgentTaskListProps {
  onSelectTask: (taskId: string) => void
  className?: string
}

export function DocAgentTaskList({ onSelectTask, className }: DocAgentTaskListProps) {
  const [tasks, setTasks] = React.useState<AgentTask[]>([])
  const [loading, setLoading] = React.useState(true)

  const fetchTasks = React.useCallback(async () => {
    try {
      const res = await fetch('/api/ai/agent')
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchTasks()
    // Refresh every 5 seconds for running tasks
    const interval = setInterval(fetchTasks, 5000)
    return () => clearInterval(interval)
  }, [fetchTasks])

  return (
    <div className={cn('flex flex-col', className)}>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bot className="mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No agent tasks yet.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Use the agent panel to start a task.
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} onSelect={onSelectTask} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
