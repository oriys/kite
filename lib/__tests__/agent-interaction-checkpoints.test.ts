import { describe, expect, it, vi } from 'vitest'
import {
  buildAgentInteractionToolResultMessage,
  createInitialAgentConversation,
  parseAgentConversation,
} from '@/lib/agent/conversation'
import {
  buildAgentInteractionFromToolCall,
  validateAgentInteractionResponse,
} from '@/lib/agent/interactive-tools'
import { buildAgentSystemPrompt } from '@/lib/agent/prompts'

vi.mock('@/lib/db', () => ({
  db: {},
}))

vi.mock('@/lib/ai-chat', () => ({
  retrieveWorkspaceRagContext: vi.fn(),
}))

describe('doc agent interaction checkpoints', () => {
  it('leaves interactive tools unresolved so the run pauses for user input', async () => {
    const { createAgentTools } = await import('@/lib/agent/tools')
    const tools = createAgentTools({
      workspaceId: 'ws_123',
      userId: 'user_123',
      taskId: 'task_123',
    }) as Record<string, { execute?: unknown }>

    expect(tools.ask_confirm.execute).toBeUndefined()
    expect(tools.ask_select.execute).toBeUndefined()
    expect(tools.ask_input.execute).toBeUndefined()
    expect(tools.ask_page).toBeUndefined()
    expect(tools.ask_page_template).toBeUndefined()
  })

  it('still validates simple inline interaction replies', () => {
    const confirmInteraction = buildAgentInteractionFromToolCall(
      'ask_confirm',
      { message: 'Confirm the release plan.' },
      'tool_call_confirm',
    )
    const selectInteraction = buildAgentInteractionFromToolCall(
      'ask_select',
      { message: 'Choose a style.', options: ['Reference', 'Tutorial'] },
      'tool_call_select',
    )
    const inputInteraction = buildAgentInteractionFromToolCall(
      'ask_input',
      { message: 'Add context.' },
      'tool_call_input',
    )

    expect(confirmInteraction.success).toBe(true)
    expect(selectInteraction.success).toBe(true)
    expect(inputInteraction.success).toBe(true)

    if (!confirmInteraction.success || !selectInteraction.success || !inputInteraction.success) {
      return
    }

    expect(
      validateAgentInteractionResponse(confirmInteraction.data, { accepted: true }),
    ).toEqual({
      type: 'confirm',
      accepted: true,
      feedback: undefined,
    })

    expect(
      validateAgentInteractionResponse(selectInteraction.data, { selected: 'Tutorial' }),
    ).toEqual({
      type: 'select',
      selected: 'Tutorial',
    })

    expect(
      validateAgentInteractionResponse(inputInteraction.data, { text: 'Focus on onboarding.' }),
    ).toEqual({
      type: 'input',
      text: 'Focus on onboarding.',
    })
  })

  it('stores interaction replies as tool-result conversation messages', () => {
    const interaction = buildAgentInteractionFromToolCall(
      'ask_select',
      {
        message: 'Choose a style.',
        options: ['Reference', 'Tutorial'],
      },
      'tool_call_2',
    )

    expect(interaction.success).toBe(true)
    if (!interaction.success) return

    const response = validateAgentInteractionResponse(interaction.data, {
      selected: 'Tutorial',
    })
    expect(response).toEqual({
      type: 'select',
      selected: 'Tutorial',
    })
    if (!response) return

    const conversation = parseAgentConversation([
      ...createInitialAgentConversation('Revise the docs.'),
      buildAgentInteractionToolResultMessage(interaction.data, response),
    ])

    expect(conversation.success).toBe(true)
  })

  it('documents staged checkpoint behavior in the system prompt', () => {
    const prompt = buildAgentSystemPrompt()

    expect(prompt).toContain('Prefer plain-text checkpoints')
    expect(prompt).toContain('Do not try to finish the entire task in one uninterrupted run.')
    expect(prompt).not.toContain('ask_page_template')
    expect(prompt).not.toContain('ask_page')
  })
})
