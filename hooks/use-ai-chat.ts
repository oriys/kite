'use client'

import * as React from 'react'

import { createClientUuid } from '@/lib/client-uuid'
import {
  type ChatMessageAttribution,
  type ChatSource,
  normalizeChatMessageAttribution,
} from '@/lib/ai-chat-shared'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: ChatSource[]
  attribution?: ChatMessageAttribution
  createdAt?: string
}

export interface ChatSession {
  id: string
  title: string
  documentId?: string | null
  createdAt: string
  updatedAt: string
}

interface SessionRefreshOptions {
  silent?: boolean
}

interface RequestReplyOptions {
  content?: string
  resume?: boolean
}

interface UseAiChatOptions {
  documentId?: string
  model?: string
}

export function useAiChat(options: UseAiChatOptions = {}) {
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [sessions, setSessions] = React.useState<ChatSession[]>([])
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = React.useState(false)
  const [canResume, setCanResume] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sessionsError, setSessionsError] = React.useState<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const messagesRef = React.useRef<ChatMessage[]>([])

  React.useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const mapChatMessage = React.useCallback(
    (message: ChatMessage): ChatMessage => ({
      id: message.id ?? createClientUuid(),
      role: message.role,
      content: message.content,
      sources: message.sources,
      attribution: normalizeChatMessageAttribution(message.attribution),
      createdAt: message.createdAt,
    }),
    [],
  )

  const fetchSessionMessages = React.useCallback(
    async (id: string) => {
      const res = await fetch(`/api/ai/chat/sessions/${id}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `Failed to load chat history (${res.status})`)
      }

      const data = (await res.json()) as { messages: ChatMessage[] }
      return data.messages.map(mapChatMessage)
    },
    [mapChatMessage],
  )

  const fetchChatSessions = React.useCallback(async () => {
    const res = await fetch('/api/ai/chat/sessions', {
      cache: 'no-store',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? `Failed to load chats (${res.status})`)
    }

    const data = (await res.json()) as { sessions: ChatSession[] }
    return data.sessions
  }, [])

  const refreshSessions = React.useCallback(
    async (refreshOptions: SessionRefreshOptions = {}) => {
      const { silent = false } = refreshOptions

      if (!silent) {
        setIsLoadingSessions(true)
        setSessionsError(null)
      }

      try {
        const nextSessions = await fetchChatSessions()
        setSessions(nextSessions)
      } catch (err) {
        if (!silent) {
          const msg = err instanceof Error ? err.message : 'Failed to load chats'
          setSessionsError(msg)
        }
      } finally {
        if (!silent) {
          setIsLoadingSessions(false)
        }
      }
    },
    [fetchChatSessions],
  )

  const syncSessionMessages = React.useCallback(
    async (id: string, expectedMessageCount?: number) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const nextMessages = await fetchSessionMessages(id)

          if (
            expectedMessageCount === undefined
            || nextMessages.length >= expectedMessageCount
          ) {
            setSessionId(id)
            setMessages(nextMessages)
            return true
          }
        } catch {
          break
        }

        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
      }

      setSessionId(id)
      return false
    },
    [fetchSessionMessages],
  )

  const requestReply = React.useCallback(
    async ({ content, resume = false }: RequestReplyOptions) => {
      const nextContent = content?.trim() ?? ''
      if (isStreaming) return
      if (!resume && !nextContent) return
      if (resume && !sessionId) return

      setError(null)
      setCanResume(false)

      const expectedMessageCount = resume
        ? undefined
        : messagesRef.current.length + 2

      if (!resume) {
        const userMessage: ChatMessage = {
          id: createClientUuid(),
          role: 'user',
          content: nextContent,
        }
        setMessages((prev) => [...prev, userMessage])
      }

      const assistantId = createClientUuid()
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '' },
      ])
      setIsStreaming(true)

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      let activeSessionId = sessionId

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...(resume ? { resume: true } : { message: nextContent }),
            sessionId: activeSessionId ?? undefined,
            documentId: options.documentId,
            model: options.model,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error ?? `Request failed (${res.status})`)
        }

        const newSessionId = res.headers.get('x-ai-chat-session')
        if (newSessionId) {
          activeSessionId = newSessionId
          setSessionId(newSessionId)
          void refreshSessions({ silent: true })
        }

        let sources: ChatMessage['sources'] = []
        const sourcesHeader = res.headers.get('x-ai-chat-sources')
        if (sourcesHeader) {
          try {
            const bytes = Uint8Array.from(atob(sourcesHeader), (char) =>
              char.charCodeAt(0),
            )
            sources = JSON.parse(new TextDecoder().decode(bytes))
          } catch {
            // Sources are supplementary metadata. Keep the streamed answer even if decoding fails.
          }
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response stream')

        const decoder = new TextDecoder()
        let fullText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: fullText, sources }
                : message,
            ),
          )
        }

        if (activeSessionId) {
          await syncSessionMessages(activeSessionId, expectedMessageCount)
          void refreshSessions({ silent: true })
        }

        setCanResume(false)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setCanResume(Boolean(activeSessionId))
          return
        }

        const msg = err instanceof Error ? err.message : 'Failed to send message'
        setError(msg)
        setMessages((prev) => prev.filter((message) => message.id !== assistantId))
        setCanResume(Boolean(activeSessionId))
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [
      isStreaming,
      options.documentId,
      options.model,
      refreshSessions,
      sessionId,
      syncSessionMessages,
    ],
  )

  const sendMessage = React.useCallback(
    async (content: string) => {
      await requestReply({ content })
    },
    [requestReply],
  )

  const resumeReply = React.useCallback(async () => {
    await requestReply({ resume: true })
  }, [requestReply])

  const stopStreaming = React.useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
    setCanResume(Boolean(sessionId))
  }, [sessionId])

  const clearChat = React.useCallback(() => {
    abortRef.current?.abort()
    setSessionId(null)
    setMessages([])
    setError(null)
    setIsStreaming(false)
    setCanResume(false)
  }, [])

  const loadSession = React.useCallback(
    async (id: string) => {
      abortRef.current?.abort()
      setError(null)
      setIsStreaming(false)
      setCanResume(false)

      try {
        const nextMessages = await fetchSessionMessages(id)
        setSessionId(id)
        setMessages(nextMessages)
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to load chat history'
        setError(msg)
      }
    },
    [fetchSessionMessages],
  )

  return {
    sessionId,
    messages,
    sessions,
    isStreaming,
    isLoadingSessions,
    canResume,
    error,
    sessionsError,
    sendMessage,
    resumeReply,
    stopStreaming,
    clearChat,
    loadSession,
    refreshSessions,
  }
}
