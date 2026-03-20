import { modelMessageSchema, type JSONValue } from 'ai'
import { z } from 'zod'
import type { AgentInteraction, AgentInteractionResponse } from '@/lib/agent/shared'
import { buildAgentInteractionToolResult } from '@/lib/agent/interactive-tools'

export const agentConversationSchema = z.array(modelMessageSchema)

export type AgentConversationMessage = z.infer<typeof agentConversationSchema>[number]

function formatConversationIssues(issues: z.ZodIssue[]) {
  return issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'conversation'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

export function createInitialAgentConversation(
  prompt: string,
): AgentConversationMessage[] {
  return [{ role: 'user', content: prompt }]
}

export function parseAgentConversation(input: unknown):
  | { success: true; data: AgentConversationMessage[] }
  | { success: false; error: string } {
  const parsed = agentConversationSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatConversationIssues(parsed.error.issues) }
  }

  return { success: true, data: parsed.data }
}

export function buildAgentInteractionToolResultMessage(
  interaction: AgentInteraction,
  response: AgentInteractionResponse,
): AgentConversationMessage {
  return {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: interaction.id,
        toolName: interaction.toolName,
        output: {
          type: 'json',
          value: toJsonValue(buildAgentInteractionToolResult(response)),
        },
      },
    ],
  }
}

function toJsonValue(value: unknown): JSONValue {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item))
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    const result: Record<string, JSONValue> = {}

    for (const [key, entryValue] of entries) {
      if (entryValue === undefined) continue
      result[key] = toJsonValue(entryValue)
    }

    return result
  }

  return null
}
