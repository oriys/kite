import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { AiCompletionError } from '@/lib/ai-server'
import {
  createChatSession,
  saveChatMessage,
  streamChatResponse,
} from '@/lib/ai-chat'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'

const MAX_MESSAGE_LENGTH = 4000

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  const documentId =
    typeof body.documentId === 'string' ? body.documentId : undefined
  const model = typeof body.model === 'string' ? body.model.trim() : undefined

  if (!message) return badRequest('Message is required')
  if (message.length > MAX_MESSAGE_LENGTH) {
    return badRequest(`Message too long. Limit is ${MAX_MESSAGE_LENGTH} characters.`)
  }

  try {
    // Resolve or create session
    let activeSessionId = sessionId
    if (!activeSessionId) {
      const session = await createChatSession({
        workspaceId: result.ctx.workspaceId,
        userId: result.ctx.userId,
        documentId,
        title: message.slice(0, 80),
      })
      activeSessionId = session.id
    }

    // Save user message
    await saveChatMessage({
      sessionId: activeSessionId,
      role: 'user',
      content: message,
    })

    // Stream RAG response
    const { stream, sources } = await streamChatResponse({
      workspaceId: result.ctx.workspaceId,
      sessionId: activeSessionId,
      userMessage: message,
      documentId,
      model,
    })

    // Collect full response for persistence (fork the stream)
    const [browserStream, persistStream] = stream.tee()

    // Save assistant message in the background
    collectStreamText(persistStream).then(async (fullText) => {
      await saveChatMessage({
        sessionId: activeSessionId,
        role: 'assistant',
        content: fullText,
        sources,
      })
    })

    return new Response(browserStream, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-ai-chat-session': activeSessionId,
        'x-ai-chat-sources': JSON.stringify(sources),
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'The AI provider request failed.'
    const status = error instanceof AiCompletionError ? error.status : 502

    return NextResponse.json({ error: message }, { status })
  }
}

async function collectStreamText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let text = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }

  return text
}
