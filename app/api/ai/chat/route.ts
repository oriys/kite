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
const RESUME_REPLY_PROMPT =
  'Continue your previous answer from where you stopped. Do not repeat completed sections unless necessary.'

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const resume = body.resume === true
  const rawMessage = typeof body.message === 'string' ? body.message.trim() : ''
  const message = resume ? RESUME_REPLY_PROMPT : rawMessage
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

  if (!resume && !rawMessage) return badRequest('Message is required')
  if (resume && !sessionId) {
    return badRequest('Session is required to resume a reply')
  }
  if (!resume && rawMessage.length > MAX_MESSAGE_LENGTH) {
    return badRequest(`Message too long. Limit is ${MAX_MESSAGE_LENGTH} characters.`)
  }

  try {
    let activeSessionId = sessionId
    if (!activeSessionId) {
      const session = await createChatSession({
        workspaceId: result.ctx.workspaceId,
        userId: result.ctx.userId,
        documentId,
        title: rawMessage.slice(0, 80),
      })
      activeSessionId = session.id
    }

    if (!resume) {
      await saveChatMessage({
        sessionId: activeSessionId,
        role: 'user',
        content: rawMessage,
      })
    }

    const { stream, sources, attributionPromise } = await streamChatResponse({
      workspaceId: result.ctx.workspaceId,
      sessionId: activeSessionId,
      userMessage: message,
      documentId,
      model,
      userId: result.ctx.userId,
      role: result.ctx.role,
      mcpPrompt,
    })

    const [browserStream, persistStream] = stream.tee()

    void Promise.all([
      collectStreamText(persistStream),
      attributionPromise.catch((error) => {
        logServerError('Failed to collect AI chat attribution.', error, {
          sessionId: activeSessionId,
        })
        return undefined
      }),
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
