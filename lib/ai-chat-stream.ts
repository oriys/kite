import type { ChatSource } from '@/lib/ai-chat-shared'

export type AiChatStreamStatusPhase =
  | 'accepted'
  | 'preparing'
  | 'streaming'

export type AiChatStreamEvent =
  | { type: 'status'; phase: AiChatStreamStatusPhase }
  | { type: 'session'; sessionId: string }
  | { type: 'sources'; sources: ChatSource[] }
  | { type: 'chunk'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function formatAiChatStreamEvent(event: AiChatStreamEvent) {
  switch (event.type) {
    case 'status':
      return `event: status\ndata: ${JSON.stringify({ phase: event.phase })}\n\n`
    case 'session':
      return `event: session\ndata: ${JSON.stringify({ sessionId: event.sessionId })}\n\n`
    case 'sources':
      return `event: sources\ndata: ${JSON.stringify({ sources: event.sources })}\n\n`
    case 'chunk':
      return `event: chunk\ndata: ${JSON.stringify({ text: event.text })}\n\n`
    case 'done':
      return 'event: done\ndata: {}\n\n'
    case 'error':
      return `event: error\ndata: ${JSON.stringify({ message: event.message })}\n\n`
  }
}

export function formatAiChatStreamComment(comment = 'keepalive') {
  return `: ${comment}\n\n`
}

export function parseAiChatStreamEvent(
  eventName: string,
  rawData: string,
): AiChatStreamEvent | null {
  const data = JSON.parse(rawData) as unknown

  switch (eventName) {
    case 'status':
      if (
        isRecord(data)
        && (data.phase === 'accepted'
          || data.phase === 'preparing'
          || data.phase === 'streaming')
      ) {
        return { type: 'status', phase: data.phase }
      }
      return null
    case 'session':
      if (isRecord(data) && typeof data.sessionId === 'string' && data.sessionId) {
        return { type: 'session', sessionId: data.sessionId }
      }
      return null
    case 'sources':
      if (isRecord(data) && Array.isArray(data.sources)) {
        return { type: 'sources', sources: data.sources as ChatSource[] }
      }
      return null
    case 'chunk':
      if (isRecord(data) && typeof data.text === 'string') {
        return { type: 'chunk', text: data.text }
      }
      return null
    case 'done':
      return { type: 'done' }
    case 'error':
      if (isRecord(data) && typeof data.message === 'string' && data.message) {
        return { type: 'error', message: data.message }
      }
      return null
    default:
      return null
  }
}
