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

interface UseAiChatOptions {
  documentId?: string
  model?: string
}

export function useAiChat(options: UseAiChatOptions = {}) {
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const messagesRef = React.useRef<ChatMessage[]>([])

  React.useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const mapChatMessage = React.useCallback((message: ChatMessage): ChatMessage => ({
    id: message.id ?? createClientUuid(),
    role: message.role,
    content: message.content,
    sources: message.sources,
    attribution: normalizeChatMessageAttribution(message.attribution),
    createdAt: message.createdAt,
  }), [])

  const fetchSessionMessages = React.useCallback(
    async (id: string) => {
      const res = await fetch(`/api/ai/chat/sessions/${id}`, {
        cache: 'no-store',
      })
      if (!res.ok) return null

      const data = (await res.json()) as { messages: ChatMessage[] }
      return data.messages.map(mapChatMessage)
    },
    [mapChatMessage],
  )

  const syncSessionMessages = React.useCallback(
    async (id: string, expectedMessageCount?: number) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const nextMessages = await fetchSessionMessages(id)
        if (!nextMessages) return

        if (
          expectedMessageCount === undefined ||
          nextMessages.length >= expectedMessageCount
        ) {
          setSessionId(id)
          setMessages(nextMessages)
          return
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 150 * (attempt + 1)),
        )
      }
    },
    [fetchSessionMessages],
  )

  const sendMessage = React.useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      setError(null)
      const expectedMessageCount = messagesRef.current.length + 2

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: createClientUuid(),
        role: 'user',
        content: content.trim(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Add placeholder for assistant
      const assistantId = createClientUuid()
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '' },
      ])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message: content.trim(),
            sessionId: sessionId ?? undefined,
            documentId: options.documentId,
            model: options.model,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error ?? `Request failed (${res.status})`)
        }

        // Capture session ID from header
        const newSessionId = res.headers.get('x-ai-chat-session')
        if (newSessionId) setSessionId(newSessionId)
        const activeSessionId = newSessionId ?? sessionId

        // Parse sources
        let sources: ChatMessage['sources'] = []
        const sourcesHeader = res.headers.get('x-ai-chat-sources')
        if (sourcesHeader) {
          try {
            const bytes = Uint8Array.from(atob(sourcesHeader), (char) =>
              char.charCodeAt(0),
            )
            sources = JSON.parse(new TextDecoder().decode(bytes))
          } catch {
            // Non-critical: sources are supplementary metadata, chat works without them
          }
        }

        // Stream the response
        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response stream')

        const decoder = new TextDecoder()
        let fullText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: fullText, sources }
                : m,
            ),
          )
        }

        if (activeSessionId) {
          await syncSessionMessages(activeSessionId, expectedMessageCount)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return

        const msg =
          err instanceof Error ? err.message : 'Failed to send message'
        setError(msg)
        // Remove the empty assistant placeholder on error
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [
      isStreaming,
      options.documentId,
      options.model,
      sessionId,
      syncSessionMessages,
    ],
  )

  const stopStreaming = React.useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const clearChat = React.useCallback(() => {
    abortRef.current?.abort()
    setSessionId(null)
    setMessages([])
    setError(null)
    setIsStreaming(false)
  }, [])

  const loadSession = React.useCallback(async (id: string) => {
    try {
      const nextMessages = await fetchSessionMessages(id)
      if (!nextMessages) return

      setSessionId(id)
      setMessages(nextMessages)
    } catch {
      // Non-critical: loading previous session is optional, user starts with empty chat
    }
  }, [fetchSessionMessages])

  return {
    sessionId,
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
    loadSession,
  }
}
