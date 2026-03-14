'use client'

import * as React from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: Array<{
    documentId: string
    chunkId: string
    title: string
    preview: string
    relationType?: 'primary' | 'reference'
    relationDescription?: string
  }>
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

  const sendMessage = React.useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      setError(null)

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Add placeholder for assistant
      const assistantId = crypto.randomUUID()
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
            // ignore
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
              m.id === assistantId ? { ...m, content: fullText, sources } : m,
            ),
          )
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
    [isStreaming, sessionId, options.documentId, options.model],
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
      const res = await fetch(`/api/ai/chat/sessions/${id}`)
      if (!res.ok) return

      const data = await res.json()
      setSessionId(id)
      setMessages(
        data.messages.map((m: ChatMessage) => ({
          id: m.id ?? crypto.randomUUID(),
          role: m.role,
          content: m.content,
          sources: m.sources,
          createdAt: m.createdAt,
        })),
      )
    } catch {
      // ignore
    }
  }, [])

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
