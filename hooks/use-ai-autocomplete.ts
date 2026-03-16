'use client'

import * as React from 'react'

import {
  AI_AUTOCOMPLETE_DEBOUNCE_MS,
  AI_AUTOCOMPLETE_MIN_PREFIX_CHARS,
  createAiAutocompleteContextKey,
  normalizeAiAutocompleteSuggestion,
  sliceAiAutocompletePrefix,
  sliceAiAutocompleteSuffix,
  type AiAutocompleteContext,
  type AiAutocompleteSurface,
} from '@/lib/ai-autocomplete'

type AiAutocompleteScheduleReason = 'input' | 'passive'

async function parseResponseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : 'Unable to load AI autocomplete'
}

export function useAiAutocomplete(input: {
  enabled: boolean
  modelId: string | null
  systemPrompt?: string
  debounceMs?: number
  onError?: (message: string) => void
}) {
  const { enabled, modelId, systemPrompt, onError } = input
  const debounceMs = input.debounceMs ?? AI_AUTOCOMPLETE_DEBOUNCE_MS

  const [suggestion, setSuggestion] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [queued, setQueued] = React.useState(false)
  const [surface, setSurface] = React.useState<AiAutocompleteSurface | null>(null)

  const abortControllerRef = React.useRef<AbortController | null>(null)
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = React.useRef(0)
  const lastContextKeyRef = React.useRef('')
  const stoppedRef = React.useRef(false)

  const cancelActiveRequest = React.useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    requestIdRef.current += 1
    setPending(false)
  }, [])

  const clear = React.useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    cancelActiveRequest()
    lastContextKeyRef.current = ''
    setQueued(false)
    setSuggestion('')
    setSurface(null)
  }, [cancelActiveRequest])

  const stop = React.useCallback(() => {
    stoppedRef.current = true
    clear()
  }, [clear])

  const requestAutocomplete = React.useCallback(
    async (context: AiAutocompleteContext, contextKey: string) => {
      if (!enabled || !modelId) {
        clear()
        return
      }

      const requestId = ++requestIdRef.current
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      setQueued(false)
      setPending(true)
      setSurface(context.surface)

      try {
        const response = await fetch('/api/ai/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({
            prefix: context.prefix,
            suffix: context.suffix,
            surface: context.surface,
            language: context.language,
            model: modelId,
            systemPrompt,
          }),
        })

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }
        if (!response.body) {
          throw new Error('The AI provider did not return an autocomplete stream.')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let streamedText = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            streamedText += decoder.decode()
            break
          }

          streamedText += decoder.decode(value, { stream: true })

          if (requestId !== requestIdRef.current || contextKey !== lastContextKeyRef.current) {
            await reader.cancel()
            return
          }

          const nextSuggestion = normalizeAiAutocompleteSuggestion({
            text: streamedText,
            prefix: context.prefix,
            suffix: context.suffix,
          })
          setSuggestion(nextSuggestion)
        }

        if (requestId !== requestIdRef.current || contextKey !== lastContextKeyRef.current) {
          return
        }

        setSuggestion(
          normalizeAiAutocompleteSuggestion({
            text: streamedText,
            prefix: context.prefix,
            suffix: context.suffix,
          }),
        )
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        if (requestId !== requestIdRef.current) {
          return
        }

        setSuggestion('')
        setSurface(null)
        onError?.(
          error instanceof Error ? error.message : 'Unable to load AI autocomplete',
        )
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
        }
        if (requestId === requestIdRef.current) {
          setPending(false)
        }
      }
    },
    [clear, enabled, modelId, onError, systemPrompt],
  )

  const schedule = React.useCallback(
    (
      nextContext: AiAutocompleteContext | null,
      options?: { reason?: AiAutocompleteScheduleReason },
    ) => {
      const reason = options?.reason ?? 'input'

      if (reason === 'input') {
        stoppedRef.current = false
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      setQueued(false)

      if (!enabled || !modelId || !nextContext) {
        clear()
        return
      }

      if (stoppedRef.current) {
        cancelActiveRequest()
        lastContextKeyRef.current = ''
        setSuggestion('')
        setSurface(null)
        return
      }

      const prefix = sliceAiAutocompletePrefix(nextContext.prefix)
      const suffix = sliceAiAutocompleteSuffix(nextContext.suffix)
      if (prefix.trim().length < AI_AUTOCOMPLETE_MIN_PREFIX_CHARS) {
        cancelActiveRequest()
        lastContextKeyRef.current = ''
        setQueued(false)
        setSuggestion('')
        setSurface(null)
        return
      }

      const context = {
        ...nextContext,
        prefix,
        suffix,
      }
      const contextKey = createAiAutocompleteContextKey({
        ...context,
        modelId,
        systemPrompt,
      })

      if (contextKey === lastContextKeyRef.current && (pending || suggestion)) {
        return
      }

      cancelActiveRequest()
      lastContextKeyRef.current = contextKey
      setSuggestion('')
      setSurface(context.surface)
      setQueued(true)

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        setQueued(false)
        void requestAutocomplete(context, contextKey)
      }, debounceMs)
    },
    [
      cancelActiveRequest,
      clear,
      debounceMs,
      enabled,
      modelId,
      pending,
      requestAutocomplete,
      suggestion,
      systemPrompt,
    ],
  )

  const accept = React.useCallback(() => {
    const value = suggestion
    if (!value) return ''
    clear()
    return value
  }, [clear, suggestion])

  React.useEffect(() => {
    if (!enabled || !modelId) {
      clear()
    }
  }, [clear, enabled, modelId])

  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      abortControllerRef.current?.abort()
    }
  }, [])

  return {
    suggestion,
    pending,
    queued,
    surface,
    schedule,
    clear,
    stop,
    accept,
  }
}
