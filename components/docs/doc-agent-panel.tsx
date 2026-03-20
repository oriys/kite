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
  HelpCircle,
} from 'lucide-react'
import { useAiModels } from '@/hooks/use-ai-models'
import type {
  AgentInteraction,
  AgentStepRecord,
  AgentTaskProgress,
  AgentTaskStatus,
} from '@/lib/agent/shared'
import {
  type DocAgentRunSettings,
  DOC_AGENT_MAX_MAX_STEPS,
  DOC_AGENT_MAX_TEMPERATURE,
  DOC_AGENT_MIN_MAX_STEPS,
  DOC_AGENT_MIN_TEMPERATURE,
  DOC_AGENT_TEMPERATURE_STEP,
  createDefaultDocAgentRunSettings,
  sanitizeDocAgentRunSettings,
} from '@/lib/agent/config'
import { DocAgentInteractionWidget } from '@/components/docs/doc-agent-interaction-widget'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'

const WORKSPACE_DEFAULT_MODEL_VALUE = '__workspace_default__'

function areRunSettingsEqual(
  left: DocAgentRunSettings,
  right: DocAgentRunSettings,
) {
  return (
    left.modelId === right.modelId &&
    left.maxSteps === right.maxSteps &&
    left.temperature === right.temperature
  )
}

function useAgentTask() {
  const [steps, setSteps] = React.useState<AgentStepRecord[]>([])
  const [status, setStatus] = React.useState<AgentTaskStatus | null>(null)
  const [progress, setProgress] = React.useState<AgentTaskProgress | null>(null)
  const [result, setResult] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [taskId, setTaskId] = React.useState<string | null>(null)
  const [interaction, setInteraction] = React.useState<AgentInteraction | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const lastInteractionIdRef = React.useRef<string | null>(null)

  const reset = React.useCallback(() => {
    setSteps([])
    setStatus(null)
    setProgress(null)
    setResult(null)
    setError(null)
    setTaskId(null)
    setInteraction(null)
    lastInteractionIdRef.current = null
  }, [])

  const respond = React.useCallback(
    async (body: Record<string, unknown>) => {
      if (!taskId || !interaction) return

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
        setInteraction(null)
        setStatus('running')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send response'
        toast.error(message)
        throw err instanceof Error ? err : new Error(message)
      }
    },
    [taskId, interaction],
  )

  const run = React.useCallback(
    async (input: {
      prompt: string
      documentId?: string
      settings: DocAgentRunSettings
    }) => {
      reset()
      setStatus('pending')

      try {
        const res = await fetch('/api/ai/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: input.prompt,
            documentId: input.documentId,
            model: input.settings.modelId ?? undefined,
            maxSteps: input.settings.maxSteps,
            temperature: input.settings.temperature,
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.message ?? `Failed to create task (${res.status})`)
        }

        const { task } = await res.json()
        setTaskId(task.id)
        setStatus('running')

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
                  case 'status':
                    if (typeof data.status === 'string') {
                      setStatus(data.status as AgentTaskStatus)
                    }
                    break
                  case 'step':
                    setSteps((prev) => [...prev, data as AgentStepRecord])
                    break
                  case 'progress':
                    setProgress(data as AgentTaskProgress)
                    break
                  case 'interaction': {
                    const ix = data as AgentInteraction
                    if (ix.id !== lastInteractionIdRef.current) {
                      lastInteractionIdRef.current = ix.id
                      setInteraction(ix)
                      setStatus('waiting_for_input')
                    }
                    break
                  }
                  case 'done':
                    setResult(data.result)
                    setStatus('completed')
                    setInteraction(null)
                    break
                  case 'error':
                    setError(data.message)
                    setStatus('failed')
                    setInteraction(null)
                    break
                  case 'cancelled':
                    setStatus('cancelled')
                    setInteraction(null)
                    break
                }
              } catch {
                // Skip malformed SSE payloads.
              }
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
    },
    [reset],
  )

  const cancel = React.useCallback(async () => {
    abortRef.current?.abort()
    if (taskId) {
      await fetch(`/api/ai/agent/${taskId}/cancel`, { method: 'POST' }).catch(
        () => {},
      )
    }
    setStatus('cancelled')
    setInteraction(null)
  }, [taskId])

  return { steps, status, progress, result, error, taskId, interaction, run, cancel, reset, respond }
}

function StatusBadge({ status }: { status: AgentTaskStatus }) {
  const config: Record<
    AgentTaskStatus,
    {
      label: string
      variant: 'default' | 'secondary' | 'outline' | 'destructive'
      icon: React.ReactNode
    }
  > = {
    pending: {
      label: 'Pending',
      variant: 'secondary',
      icon: <Clock className="size-3" />,
    },
    running: {
      label: 'Running',
      variant: 'default',
      icon: <Loader2 className="size-3 animate-spin" />,
    },
    waiting_for_input: {
      label: 'Needs input',
      variant: 'secondary',
      icon: <HelpCircle className="size-3 text-amber-500" />,
    },
    completed: {
      label: 'Done',
      variant: 'outline',
      icon: <CheckCircle2 className="size-3 text-emerald-500" />,
    },
    failed: {
      label: 'Failed',
      variant: 'destructive',
      icon: <XCircle className="size-3" />,
    },
    cancelled: {
      label: 'Cancelled',
      variant: 'secondary',
      icon: <Square className="size-3" />,
    },
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
        <p className="text-sm whitespace-pre-wrap text-foreground">{step.text}</p>
      </div>
    )
  }

  const calls = step.toolCalls ?? []
  return (
    <div className="py-1.5">
      {calls.map((tc, i) => {
        return (
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
              <span className="font-mono text-xs text-muted-foreground">
                {tc.name}
              </span>
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
                {tc.error && <p className="text-xs text-destructive">{tc.error}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface DocAgentPanelProps {
  documentId?: string
  onClose?: () => void
  className?: string
}

export function DocAgentPanel({
  documentId,
  onClose,
  className,
}: DocAgentPanelProps) {
  const { steps, status, progress, result, error, interaction, run, cancel, reset, respond } =
    useAgentTask()
  const {
    items: aiModels,
    defaultModelId,
    enabledModelIds,
    loading: aiModelsLoading,
    error: aiModelsError,
  } = useAiModels()
  const [input, setInput] = React.useState('')
  const [runSettings, setRunSettings] = React.useState<DocAgentRunSettings>(() =>
    createDefaultDocAgentRunSettings(),
  )
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const isActive = status === 'pending' || status === 'running' || status === 'waiting_for_input'

  const availableModels = React.useMemo(() => {
    const enabledModelIdSet = new Set(enabledModelIds)
    if (enabledModelIdSet.size === 0) return aiModels

    const enabledModels = aiModels.filter((model) => enabledModelIdSet.has(model.id))
    return enabledModels.length > 0 ? enabledModels : aiModels
  }, [aiModels, enabledModelIds])

  const availableModelIds = React.useMemo(
    () => availableModels.map((model) => model.id),
    [availableModels],
  )

  const workspaceDefaultModel = React.useMemo(
    () => aiModels.find((model) => model.id === defaultModelId) ?? null,
    [aiModels, defaultModelId],
  )

  const selectedModel = React.useMemo(
    () =>
      availableModels.find((model) => model.id === runSettings.modelId) ?? null,
    [availableModels, runSettings.modelId],
  )

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [steps.length])

  React.useEffect(() => {
    setRunSettings((current) => {
      const next = sanitizeDocAgentRunSettings(current, { availableModelIds })
      return areRunSettingsEqual(current, next) ? current : next
    })
  }, [availableModelIds])

  const updateRunSettings = React.useCallback(
    (updater: (current: DocAgentRunSettings) => DocAgentRunSettings) => {
      setRunSettings((current) =>
        sanitizeDocAgentRunSettings(updater(current), { availableModelIds }),
      )
    },
    [availableModelIds],
  )

  const handleSubmit = () => {
    const prompt = input.trim()
    if (!prompt || isActive) return
    setInput('')
    run({ prompt, documentId, settings: runSettings }).catch((err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Agent failed')
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleTemperatureChange = React.useCallback(
    (values: number[]) => {
      const nextValue = values[0]
      if (typeof nextValue !== 'number') return

      updateRunSettings((current) => ({
        ...current,
        temperature: nextValue,
      }))
    },
    [updateRunSettings],
  )

  const handleMaxStepsChange = React.useCallback(
    (values: number[]) => {
      const nextValue = values[0]
      if (typeof nextValue !== 'number') return

      updateRunSettings((current) => ({
        ...current,
        maxSteps: nextValue,
      }))
    },
    [updateRunSettings],
  )

  const settingsSummary = runSettings.modelId
    ? `${selectedModel?.label ?? 'Custom model'} · temp ${runSettings.temperature.toFixed(1)} · ${runSettings.maxSteps} steps`
    : `Workspace default · temp ${runSettings.temperature.toFixed(1)} · ${runSettings.maxSteps} steps`

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-l border-border/60 bg-background',
        className,
      )}
    >
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

      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="space-y-0.5 px-4 py-3">
          {steps.length === 0 && !status && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="mb-3 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Ask the agent to draft, revise, review, or structure this document.
              </p>
            </div>
          )}

          {steps.map((step) => (
            <StepItem key={step.index} step={step} />
          ))}

          {interaction && (
            <DocAgentInteractionWidget interaction={interaction} onRespond={respond} />
          )}

          {isActive && progress?.description && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              {status === 'waiting_for_input' ? (
                <HelpCircle className="size-3 text-amber-500" />
              ) : (
                <Loader2 className="size-3 animate-spin" />
              )}
              {progress.description}
              <span className="tabular-nums">
                ({progress.currentStep}/{progress.maxSteps})
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {status === 'completed' &&
            result &&
            steps[steps.length - 1]?.type !== 'response' && (
              <div className="flex gap-2 border-t border-border/40 pt-3">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                <p className="text-sm whitespace-pre-wrap text-foreground">{result}</p>
              </div>
            )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 p-3">
        <div className="mb-3 rounded-md border border-border/60 bg-muted/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">Run settings</p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {settingsSummary}
              </p>
            </div>
            {aiModelsLoading && (
              <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-foreground">Model</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {runSettings.modelId
                    ? selectedModel?.provider ?? 'Override'
                    : workspaceDefaultModel?.label ?? 'Workspace default'}
                </span>
              </div>
              <Select
                value={runSettings.modelId ?? WORKSPACE_DEFAULT_MODEL_VALUE}
                onValueChange={(value) => {
                  updateRunSettings((current) => ({
                    ...current,
                    modelId:
                      value === WORKSPACE_DEFAULT_MODEL_VALUE ? null : value,
                  }))
                }}
                disabled={isActive}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue placeholder="Workspace default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={WORKSPACE_DEFAULT_MODEL_VALUE}>
                    Workspace default
                  </SelectItem>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.label} · {model.provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {runSettings.modelId
                  ? `This run will use ${selectedModel?.label ?? runSettings.modelId}.`
                  : workspaceDefaultModel
                    ? `Falls back to the workspace default model: ${workspaceDefaultModel.label}.`
                    : 'Falls back to the workspace default model.'}
              </p>
              {aiModelsError && (
                <p className="text-[11px] text-destructive">{aiModelsError}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-foreground">
                  Temperature
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {runSettings.temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[runSettings.temperature]}
                onValueChange={handleTemperatureChange}
                min={DOC_AGENT_MIN_TEMPERATURE}
                max={DOC_AGENT_MAX_TEMPERATURE}
                step={DOC_AGENT_TEMPERATURE_STEP}
                disabled={isActive}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-foreground">
                  Max steps
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {runSettings.maxSteps}
                </span>
              </div>
              <Slider
                value={[runSettings.maxSteps]}
                onValueChange={handleMaxStepsChange}
                min={DOC_AGENT_MIN_MAX_STEPS}
                max={DOC_AGENT_MAX_MAX_STEPS}
                step={1}
                disabled={isActive}
              />
            </div>
          </div>
        </div>

        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent to draft, revise, or review…"
            disabled={isActive}
            className="min-h-[72px] resize-none pr-12 text-sm"
            rows={3}
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute bottom-1.5 right-1.5 size-10 rounded-xl"
            onClick={handleSubmit}
            disabled={isActive || !input.trim()}
            aria-label="Send prompt to Doc Agent"
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
