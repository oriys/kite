import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { AiCompletionError } from '@/lib/ai-server'
import {
  createChatSession,
  saveChatMessage,
  streamChatResponse,
} from '@/lib/ai-chat'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import { logServerError } from '@/lib/server-errors'

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
  const mcpPrompt =
    body.mcpPrompt &&
    typeof body.mcpPrompt === 'object' &&
    typeof body.mcpPrompt.serverId === 'string' &&
    typeof body.mcpPrompt.name === 'string'
      ? {
          serverId: body.mcpPrompt.serverId as string,
          name: body.mcpPrompt.name as string,
          arguments:
            body.mcpPrompt.arguments &&
            typeof body.mcpPrompt.arguments === 'object'
              ? (body.mcpPrompt.arguments as Record<string, string>)
              : undefined,
        }
      : undefined

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
    const { stream, sources, attributionPromise } = await streamChatResponse({
      workspaceId: result.ctx.workspaceId,
      sessionId: activeSessionId,
      userMessage: message,
      documentId,
      model,
      mcpPrompt,
    })

    // Collect full response for persistence (fork the stream)
    const [browserStream, persistStream] = stream.tee()

    // Save assistant message in the background
    void Promise.all([
      collectStreamText(persistStream),
      attributionPromise.catch((error) => {
        logServerError('Failed to collect AI chat attribution.', error, {
          sessionId: activeSessionId,
        })
        return undefined
      })
    ])
      .then(async ([fullText, attribution]) => {
        await saveChatMessage({
          sessionId: activeSessionId,
          role: 'assistant',
          content: fullText,
          sources,
          attribution,
        })
      })
      .catch((error) => {
        logServerError('Failed to persist assistant chat message.', error, {
          sessionId: activeSessionId,
        })
      })

    return new Response(browserStream, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-ai-chat-session': activeSessionId,
        'x-ai-chat-sources': Buffer.from(
          JSON.stringify(sources),
          'utf8',
        ).toString('base64'),
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
