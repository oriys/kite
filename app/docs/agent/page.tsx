'use client'

import * as React from 'react'
import { Bot } from 'lucide-react'
import { DocAgentPanel } from '@/components/docs/doc-agent-panel'
import { DocAgentTaskList } from '@/components/docs/doc-agent-task-list'
import { DocAgentStepView } from '@/components/docs/doc-agent-step-view'

export default function AgentPage() {
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null)

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-8 sm:px-6">
      {/* Left: Task list or detail */}
      <div className="min-w-0 flex-1">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Doc Agent</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            AI agent that can search, create, update, and review your documentation autonomously.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/60">
          {selectedTaskId ? (
            <DocAgentStepView
              taskId={selectedTaskId}
              onBack={() => setSelectedTaskId(null)}
            />
          ) : (
            <DocAgentTaskList onSelectTask={setSelectedTaskId} />
          )}
        </div>
      </div>

      {/* Right: Agent panel */}
      <div className="hidden w-[380px] shrink-0 lg:block">
        <div className="sticky top-8 h-[calc(100dvh-8rem)] overflow-hidden rounded-lg border border-border/60">
          <DocAgentPanel />
        </div>
      </div>
    </div>
  )
}
