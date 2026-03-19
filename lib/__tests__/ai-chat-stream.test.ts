import { describe, expect, it } from 'vitest'

import {
  formatAiChatStreamComment,
  formatAiChatStreamEvent,
  parseAiChatStreamEvent,
} from '@/lib/ai-chat-stream'

describe('ai chat stream helpers', () => {
  it('formats and parses status events', () => {
    const raw = formatAiChatStreamEvent({
      type: 'status',
      phase: 'preparing',
    })

    expect(raw).toBe('event: status\ndata: {"phase":"preparing"}\n\n')
    expect(
      parseAiChatStreamEvent('status', '{"phase":"preparing"}'),
    ).toEqual({
      type: 'status',
      phase: 'preparing',
    })
  })

  it('formats and parses session and chunk events', () => {
    expect(
      parseAiChatStreamEvent('session', '{"sessionId":"chat_123"}'),
    ).toEqual({
      type: 'session',
      sessionId: 'chat_123',
    })

    expect(
      parseAiChatStreamEvent('chunk', '{"text":"hello"}'),
    ).toEqual({
      type: 'chunk',
      text: 'hello',
    })
  })

  it('formats and parses source events', () => {
    const sources = [
      {
        documentId: 'doc_1',
        chunkId: 'chunk_1',
        title: 'Auth',
        preview: 'Auth preview',
      },
    ]

    const raw = formatAiChatStreamEvent({
      type: 'sources',
      sources,
    })

    expect(raw).toContain('event: sources')
    expect(
      parseAiChatStreamEvent('sources', JSON.stringify({ sources })),
    ).toEqual({
      type: 'sources',
      sources,
    })
  })

  it('handles done and error events', () => {
    expect(formatAiChatStreamEvent({ type: 'done' })).toBe(
      'event: done\ndata: {}\n\n',
    )
    expect(parseAiChatStreamEvent('done', '{}')).toEqual({ type: 'done' })
    expect(
      parseAiChatStreamEvent('error', '{"message":"boom"}'),
    ).toEqual({
      type: 'error',
      message: 'boom',
    })
  })

  it('formats heartbeat comments and rejects malformed payloads', () => {
    expect(formatAiChatStreamComment()).toBe(': keepalive\n\n')
    expect(parseAiChatStreamEvent('status', '{"phase":"unknown"}')).toBeNull()
    expect(parseAiChatStreamEvent('chunk', '{"text":1}')).toBeNull()
  })
})
