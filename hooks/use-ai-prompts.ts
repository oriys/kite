'use client'

import * as React from 'react'

import { AI_TRANSFORM_ACTIONS } from '@/lib/ai'
import {
  AI_PROMPTS_EVENT,
  AI_PROMPTS_STORAGE_KEY,
  countCustomizedAiPrompts,
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

function readStoredPrompts() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(AI_PROMPTS_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<AiPromptSettings>
  } catch {
    return null
  }
}

function persistPrompts(nextPrompts: AiPromptSettings) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    AI_PROMPTS_STORAGE_KEY,
    JSON.stringify(nextPrompts),
  )
  window.dispatchEvent(new CustomEvent(AI_PROMPTS_EVENT))
}

export function useAiPrompts() {
  const [prompts, setPrompts] = React.useState<AiPromptSettings>(() =>
    createDefaultAiPromptSettings(),
  )
  const promptsRef = React.useRef(prompts)

  React.useEffect(() => {
    promptsRef.current = prompts
  }, [prompts])

  const syncPrompts = React.useCallback(() => {
    const storedPrompts = readStoredPrompts()
    const nextPrompts = sanitizeAiPromptSettings(storedPrompts)

    setPrompts((current) =>
      arePromptSettingsEqual(current, nextPrompts) ? current : nextPrompts,
    )

    if (
      !storedPrompts ||
      !arePromptSettingsEqual(
        sanitizeAiPromptSettings(storedPrompts),
        nextPrompts,
      )
    ) {
      persistPrompts(nextPrompts)
    }
  }, [])

  React.useEffect(() => {
    syncPrompts()
  }, [syncPrompts])

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== AI_PROMPTS_STORAGE_KEY) {
        return
      }

      syncPrompts()
    }

    const handleCustomEvent = () => {
      syncPrompts()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(AI_PROMPTS_EVENT, handleCustomEvent)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(AI_PROMPTS_EVENT, handleCustomEvent)
    }
  }, [syncPrompts])

  const savePrompts = React.useCallback((nextPrompts: AiPromptSettings) => {
    const sanitized = sanitizeAiPromptSettings(nextPrompts)

    if (arePromptSettingsEqual(promptsRef.current, sanitized)) {
      return sanitized
    }

    promptsRef.current = sanitized
    setPrompts(sanitized)
    persistPrompts(sanitized)

    return sanitized
  }, [])

  const resetPrompts = React.useCallback(() => {
    const nextPrompts = createDefaultAiPromptSettings()
    promptsRef.current = nextPrompts
    setPrompts(nextPrompts)
    persistPrompts(nextPrompts)

    return nextPrompts
  }, [])

  return {
    prompts,
    customizedCount: countCustomizedAiPrompts(prompts),
    savePrompts,
    resetPrompts,
  }
}
