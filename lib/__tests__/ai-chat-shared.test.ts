import { describe, expect, it } from 'vitest'

import {
  collectMcpToolNamesFromSteps,
  createChatMessageAttribution,
  normalizeChatMessageAttribution,
} from '../ai-chat-shared'

describe('ai-chat-shared', () => {
  it('deduplicates MCP tool names from steps', () => {
    expect(
      collectMcpToolNamesFromSteps([
        { toolCalls: [{ toolName: 'docs___search' }, { toolName: 'docs___read' }] },
        { toolCalls: [{ toolName: 'docs___search' }, { toolName: '  ' }] },
      ]),
    ).toEqual(['docs___search', 'docs___read'])
  })

  it('creates attribution when MCP was used without tool names', () => {
    expect(createChatMessageAttribution({ usedMcp: true })).toEqual({
      usedMcp: true,
      mcpToolNames: [],
    })
  })

  it('returns undefined when MCP was not used', () => {
    expect(createChatMessageAttribution({})).toBeUndefined()
  })

  it('normalizes persisted attribution objects', () => {
    expect(
      normalizeChatMessageAttribution({
        usedMcp: true,
        mcpToolNames: ['docs___search', 'docs___search', 1],
      }),
    ).toEqual({
      usedMcp: true,
      mcpToolNames: ['docs___search'],
    })
  })
})
