import type { DocAgentInteractivePageSpec } from '@/lib/agent/interactive-page'

export type AgentTaskStatus =
  | 'pending'
  | 'running'
  | 'waiting_for_input'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface AgentTaskProgress {
  currentStep: number
  maxSteps: number
  description?: string
}

export interface AgentToolCallRecord {
  name: string
  args: Record<string, unknown>
  result?: string
  error?: string
  durationMs?: number
}

export interface AgentStepRecord {
  index: number
  type: 'tool_call' | 'response'
  toolCalls?: AgentToolCallRecord[]
  text?: string
  durationMs?: number
}

export type AgentInteraction =
  | { id: string; type: 'confirm'; message: string }
  | { id: string; type: 'select'; message: string; options: string[] }
  | { id: string; type: 'input'; message: string; placeholder?: string }
  | { id: string; type: 'page'; message: string; spec: DocAgentInteractivePageSpec }

export type AgentInteractionResponse =
  | { type: 'confirm'; accepted: boolean; feedback?: string }
  | { type: 'select'; selected: string }
  | { type: 'input'; text: string }
  | { type: 'page'; action: string; values: Record<string, unknown> }
