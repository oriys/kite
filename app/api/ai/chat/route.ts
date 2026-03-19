import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  formatAiChatStreamComment,
  formatAiChatStreamEvent,
  type AiChatStreamEvent,
} from '@/lib/ai-chat-stream'
import {
  createChatSession,
  saveChatMessage,
  streamChatResponse,
} from '@/lib/ai-chat'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { aiChatSessions } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { isRagQueryMode } from '@/lib/rag/types'
import { logServerError } from '@/lib/server-errors'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

const MAX_MESSAGE_LENGTH = 4000
const CHAT_STREAM_KEEPALIVE_MS = 10_000
const RESUME_REPLY_PROMPT =
  'Continue your previous answer from where you stopped. Do not repeat completed sections unless necessary.'

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const rl = checkRateLimit(`ai-chat:${result.ctx.userId}`, RATE_LIMITS.aiChat)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before sending another message.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
    )
  }

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const resume = body.resume === true
  const rawMessage = typeof body.message === 'string' ? body.message.trim() : ''
  const message = resume ? RESUME_REPLY_PROMPT : rawMessage
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  const documentId =
    typeof body.documentId === 'string' ? body.documentId : undefined
  const model = typeof body.model === 'string' ? body.model.trim() : undefined
  const ragMode =
    typeof body.ragMode === 'string' && isRagQueryMode(body.ragMode)
      ? body.ragMode
      : undefined
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

  if (sessionId) {
    const session = await db.query.aiChatSessions.findFirst({
      where: and(
        eq(aiChatSessions.id, sessionId),
        eq(aiChatSessions.workspaceId, result.ctx.workspaceId),
      ),
    })
    if (!session) return badRequest('Invalid session')
  }
  if (!resume && rawMessage.length > MAX_MESSAGE_LENGTH) {
    return badRequest(`Message too long. Limit is ${MAX_MESSAGE_LENGTH} characters.`)
  }

  const encoder = new TextEncoder()
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let closed = false

  const cleanup = () => {
    if (heartbeat) {
      clearInterval(heartbeat)
      heartbeat = null
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let activeSessionId = sessionId

      const close = () => {
        if (closed) return
        closed = true
        cleanup()
        controller.close()
      }

      const sendRaw = (value: string) => {
        if (closed) return
        controller.enqueue(encoder.encode(value))
      }

      const sendEvent = (
        event: AiChatStreamEvent,
      ) => {
        sendRaw(formatAiChatStreamEvent(event))
      }

      try {
        sendEvent({ type: 'status', phase: 'accepted' })
        heartbeat = setInterval(() => {
          try {
            sendRaw(formatAiChatStreamComment())
          } catch {
            cleanup()
          }
        }, CHAT_STREAM_KEEPALIVE_MS)

        if (!activeSessionId) {
          const session = await createChatSession({
            workspaceId: result.ctx.workspaceId,
            userId: result.ctx.userId,
            documentId,
            title: rawMessage.slice(0, 80),
          })
          activeSessionId = session.id
        }

        sendEvent({ type: 'session', sessionId: activeSessionId })

        if (!resume) {
          await saveChatMessage({
            sessionId: activeSessionId,
            role: 'user',
            content: rawMessage,
          })
        }

        sendEvent({ type: 'status', phase: 'preparing' })

        const { stream, sources, attributionPromise } = await streamChatResponse({
          workspaceId: result.ctx.workspaceId,
          sessionId: activeSessionId,
          userMessage: message,
          documentId,
          model,
          userId: result.ctx.userId,
          role: result.ctx.role,
          ragMode,
          mcpPrompt,
        })

        sendEvent({ type: 'sources', sources })
        sendEvent({ type: 'status', phase: 'streaming' })

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

        const reader = browserStream.getReader()
        const decoder = new TextDecoder()

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const text = decoder.decode(value, { stream: true })
            if (text) {
              sendEvent({ type: 'chunk', text })
            }
          }

          const trailing = decoder.decode()
          if (trailing) {
            sendEvent({ type: 'chunk', text: trailing })
          }
        } finally {
          reader.releaseLock()
        }

        sendEvent({ type: 'done' })
        close()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'The AI provider request failed.'

        logServerError(
          'AI chat stream failed.',
          error instanceof Error ? error : new Error(message),
          {
            sessionId: activeSessionId,
          },
        )

        sendEvent({ type: 'error', message })
        close()
      }
    },
    cancel() {
      closed = true
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  })
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

  text += decoder.decode()
  return text
}
