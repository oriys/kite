import { z } from 'zod'
import {
  parseDocAgentInteractivePageResponse,
  validateDocAgentInteractivePageSpec,
} from '@/lib/agent/interactive-page'
import {
  buildDocAgentInteractivePageTemplate,
  docAgentInteractivePageTemplateInputSchema,
} from '@/lib/agent/interactive-page-templates'
import type {
  AgentInteraction,
  AgentInteractionResponse,
  AgentInteractiveToolName,
} from '@/lib/agent/shared'

export const askConfirmInputSchema = z.object({
  message: z.string().trim().min(1).max(1000),
})

export const askSelectInputSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
})

export const askInputInputSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  placeholder: z.string().trim().max(180).optional(),
})

export { docAgentInteractivePageTemplateInputSchema }

export const AGENT_INTERACTIVE_TOOL_NAMES = [
  'ask_confirm',
  'ask_select',
  'ask_input',
  'ask_page',
  'ask_page_template',
] as const satisfies readonly AgentInteractiveToolName[]

function formatZodIssues(issues: z.ZodIssue[]) {
  return issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'input'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

export function isAgentInteractiveToolName(
  value: string,
): value is AgentInteractiveToolName {
  return (AGENT_INTERACTIVE_TOOL_NAMES as readonly string[]).includes(value)
}

export function buildAgentInteractionFromToolCall(
  toolName: AgentInteractiveToolName,
  input: unknown,
  toolCallId: string,
):
  | { success: true; data: AgentInteraction }
  | { success: false; error: string } {
  switch (toolName) {
    case 'ask_confirm': {
      const parsed = askConfirmInputSchema.safeParse(input)
      if (!parsed.success) {
        return { success: false, error: formatZodIssues(parsed.error.issues) }
      }

      return {
        success: true,
        data: {
          id: toolCallId,
          toolName,
          type: 'confirm',
          message: parsed.data.message,
        },
      }
    }

    case 'ask_select': {
      const parsed = askSelectInputSchema.safeParse(input)
      if (!parsed.success) {
        return { success: false, error: formatZodIssues(parsed.error.issues) }
      }

      return {
        success: true,
        data: {
          id: toolCallId,
          toolName,
          type: 'select',
          message: parsed.data.message,
          options: parsed.data.options,
        },
      }
    }

    case 'ask_input': {
      const parsed = askInputInputSchema.safeParse(input)
      if (!parsed.success) {
        return { success: false, error: formatZodIssues(parsed.error.issues) }
      }

      return {
        success: true,
        data: {
          id: toolCallId,
          toolName,
          type: 'input',
          message: parsed.data.message,
          placeholder: parsed.data.placeholder,
        },
      }
    }

    case 'ask_page': {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { success: false, error: 'input: Invalid interactive page request.' }
      }

      const record = input as { message?: unknown; spec?: unknown }
      const message = typeof record.message === 'string' ? record.message.trim() : ''
      if (!message) {
        return { success: false, error: 'message: Short page context is required.' }
      }

      const validation = validateDocAgentInteractivePageSpec(record.spec)
      if (!validation.success) {
        return { success: false, error: validation.error }
      }

      return {
        success: true,
        data: {
          id: toolCallId,
          toolName,
          type: 'page',
          message,
          spec: validation.data,
        },
      }
    }

    case 'ask_page_template': {
      const parsed = docAgentInteractivePageTemplateInputSchema.safeParse(input)
      if (!parsed.success) {
        return { success: false, error: formatZodIssues(parsed.error.issues) }
      }

      const built = buildDocAgentInteractivePageTemplate(parsed.data)
      const validation = validateDocAgentInteractivePageSpec(built.spec)
      if (!validation.success) {
        return { success: false, error: validation.error }
      }

      return {
        success: true,
        data: {
          id: toolCallId,
          toolName,
          type: 'page',
          message: built.message,
          spec: validation.data,
        },
      }
    }
  }
}

export function validateAgentInteractionResponse(
  interaction: AgentInteraction,
  body: Record<string, unknown>,
): AgentInteractionResponse | null {
  switch (interaction.type) {
    case 'confirm': {
      if (typeof body.accepted !== 'boolean') return null
      const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : undefined
      return { type: 'confirm', accepted: body.accepted, feedback }
    }

    case 'select': {
      if (typeof body.selected !== 'string') return null
      if (!interaction.options.includes(body.selected)) return null
      return { type: 'select', selected: body.selected }
    }

    case 'input': {
      if (typeof body.text !== 'string') return null
      return { type: 'input', text: body.text.trim() }
    }

    case 'page': {
      const parsed = parseDocAgentInteractivePageResponse(body)
      if (!parsed.success) return null
      return {
        type: 'page',
        action: parsed.data.action,
        values: parsed.data.values,
      }
    }
  }
}

export function buildAgentInteractionToolResult(
  response: AgentInteractionResponse,
) {
  switch (response.type) {
    case 'confirm':
      return { accepted: response.accepted, feedback: response.feedback ?? null }
    case 'select':
      return { selected: response.selected }
    case 'input':
      return { text: response.text }
    case 'page':
      return { action: response.action, values: response.values }
  }
}
