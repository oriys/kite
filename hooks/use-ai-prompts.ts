'use client'

import * as React from 'react'
import { toast } from 'sonner'

import { AI_TRANSFORM_ACTIONS } from '@/lib/ai'
import {
  AI_PROMPTS_EVENT,
  createDefaultAiPromptSettings,
  sanitizeAiPromptSettings,
  type AiPromptSettings,
} from '@/lib/ai-prompts'

function arePromptSettingsEqual(
  left: AiPromptSettings,
  right: AiPromptSettings,
) {
  if (left.systemPrompt !== right.systemPrompt) {
    return false
  }

  return AI_TRANSFORM_ACTIONS.every(
    (action) =>
      left.actionPrompts[action] === right.actionPrompts[action] &&
      left.actionModelIds[action] === right.actionModelIds[action],
  )
}

function dispatchPromptsEvent(prompts: AiPromptSettings) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<AiPromptSettings>(AI_PROMPTS_EVENT, {
      detail: prompts,
    }),
  )
}

async function parseResponseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string'
    ? body.error
    : 'Unable to save AI prompt settings'
}

export function useAiPrompts() {
  const [prompts, setPrompts] = React.useState<AiPromptSettings>(() =>
    createDefaultAiPromptSettings(),
  )
  const [loading, setLoading] = React.useState(true)
  const promptsRef = React.useRef(prompts)

  React.useEffect(() => {
    promptsRef.current = prompts
  }, [prompts])

  const syncPrompts = React.useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/ai/settings/prompts', {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(await parseResponseError(response))
      }

      const nextPrompts = sanitizeAiPromptSettings(
        (await response.json()) as Partial<AiPromptSettings>,
      )

      promptsRef.current = nextPrompts
      setPrompts((current) =>
        arePromptSettingsEqual(current, nextPrompts) ? current : nextPrompts,
      )
    } catch (error) {
      const fallback = createDefaultAiPromptSettings()
      promptsRef.current = fallback
      setPrompts((current) =>
        arePromptSettingsEqual(current, fallback) ? current : fallback,
      )
      toast.error('Unable to load AI prompt settings', {
        description:
          error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void syncPrompts()
  }, [syncPrompts])

  React.useEffect(() => {
    const handlePromptEvent = (event: Event) => {
      const nextPrompts = sanitizeAiPromptSettings(
        (event as CustomEvent<AiPromptSettings>).detail,
      )

      promptsRef.current = nextPrompts
      setPrompts((current) =>
        arePromptSettingsEqual(current, nextPrompts) ? current : nextPrompts,
      )
    }

    window.addEventListener(AI_PROMPTS_EVENT, handlePromptEvent)

    return () => {
      window.removeEventListener(AI_PROMPTS_EVENT, handlePromptEvent)
    }
  }, [])

  const persistPrompts = React.useCallback(
    async (nextPrompts: AiPromptSettings, previous: AiPromptSettings) => {
      try {
        const response = await fetch('/api/ai/settings/prompts', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompts: nextPrompts }),
        })

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const saved = sanitizeAiPromptSettings(
          (await response.json()) as Partial<AiPromptSettings>,
        )
        promptsRef.current = saved
        setPrompts(saved)
        dispatchPromptsEvent(saved)
      } catch (error) {
        promptsRef.current = previous
        setPrompts(previous)
        toast.error('Unable to save AI prompt settings', {
          description:
            error instanceof Error ? error.message : 'Please try again.',
        })
      }
    },
    [],
  )

  const savePrompts = React.useCallback(
    (nextPrompts: AiPromptSettings) => {
      const sanitized = sanitizeAiPromptSettings(nextPrompts)

      if (arePromptSettingsEqual(promptsRef.current, sanitized)) {
        return sanitized
      }

      const previous = promptsRef.current
      promptsRef.current = sanitized
      setPrompts(sanitized)
      dispatchPromptsEvent(sanitized)
      void persistPrompts(sanitized, previous)

      return sanitized
    },
    [persistPrompts],
  )

  const resetPrompts = React.useCallback(() => {
    const nextPrompts = createDefaultAiPromptSettings()

    if (arePromptSettingsEqual(promptsRef.current, nextPrompts)) {
      return nextPrompts
    }

    const previous = promptsRef.current
    promptsRef.current = nextPrompts
    setPrompts(nextPrompts)
    dispatchPromptsEvent(nextPrompts)
    void persistPrompts(nextPrompts, previous)

    return nextPrompts
  }, [persistPrompts])

  return {
    prompts,
    loading,
    savePrompts,
    resetPrompts,
  }
}
