import { describe, expect, it } from 'vitest'

import { buildChatSystemPrompt, hasChatGrounding } from '../ai-chat-prompt'

describe('ai-chat-prompt', () => {
  it('treats MCP tools as grounding even when docs miss', () => {
    expect(
      hasChatGrounding({
        hasDocumentationContext: false,
        hasMcpTools: true,
        hasMcpPromptMessages: false,
      }),
    ).toBe(true)
  })

  it('includes documentation context when available', () => {
    expect(
      buildChatSystemPrompt({
        documentationContext: 'Context block [1]',
        hasMcpTools: true,
        hasMcpPromptMessages: false,
      }),
    ).toContain('Documentation context:\n\nContext block [1]')
  })

  it('guides the model to use MCP when docs are unavailable', () => {
    const prompt = buildChatSystemPrompt({
      documentationContext: '',
      hasMcpTools: true,
      hasMcpPromptMessages: false,
    })

    expect(prompt).toContain(
      'No workspace documentation context was retrieved for this question.',
    )
    expect(prompt).toContain('enabled MCP tools')
  })
})
