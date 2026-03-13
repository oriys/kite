'use client'

import * as React from 'react'
import { toast } from 'sonner'

import {
  AI_MODEL_PREFERENCES_EVENT,
  sanitizeAiModelPreferences,
  type AiCatalogModel,
  type AiModelPreferences,
} from '@/lib/ai'

function arePreferencesEqual(
  left: AiModelPreferences,
  right: AiModelPreferences,
) {
  return (
    left.activeModelId === right.activeModelId &&
    left.enabledModelIds.length === right.enabledModelIds.length &&
    left.enabledModelIds.every(
      (value, index) => value === right.enabledModelIds[index],
    )
  )
}

function getInitialPreferences(
  models: AiCatalogModel[],
  defaultModelId?: string,
  initialEnabledModelIds: string[] = [],
) {
  const sanitized = sanitizeAiModelPreferences(
    {
      activeModelId: defaultModelId?.trim() || '',
      enabledModelIds: initialEnabledModelIds,
    },
    models,
  )

  if (
    sanitized.enabledModelIds.length === 0 &&
    sanitized.activeModelId === null &&
    defaultModelId?.trim()
  ) {
    return {
      activeModelId: null,
      enabledModelIds: [],
    } satisfies AiModelPreferences
  }

  return sanitized
}

function dispatchPreferencesEvent(preferences: AiModelPreferences) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<AiModelPreferences>(AI_MODEL_PREFERENCES_EVENT, {
      detail: preferences,
    }),
  )
}

async function parseResponseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string'
    ? body.error
    : 'Unable to save AI model settings'
}

export function useAiPreferences(
  models: AiCatalogModel[],
  defaultModelId?: string,
  initialEnabledModelIds: string[] = [],
) {
  const [preferences, setPreferences] = React.useState<AiModelPreferences>(() =>
    getInitialPreferences(models, defaultModelId, initialEnabledModelIds),
  )
  const preferencesRef = React.useRef(preferences)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  React.useEffect(() => {
    const nextPreferences = getInitialPreferences(
      models,
      defaultModelId,
      initialEnabledModelIds,
    )

    setPreferences((current) =>
      arePreferencesEqual(current, nextPreferences) ? current : nextPreferences,
    )
    preferencesRef.current = nextPreferences
  }, [defaultModelId, initialEnabledModelIds, models])

  React.useEffect(() => {
    const handlePreferencesChange = (event: Event) => {
      const nextPreferences = sanitizeAiModelPreferences(
        (event as CustomEvent<AiModelPreferences>).detail,
        models,
      )

      setPreferences((current) =>
        arePreferencesEqual(current, nextPreferences) ? current : nextPreferences,
      )
      preferencesRef.current = nextPreferences
    }

    window.addEventListener(AI_MODEL_PREFERENCES_EVENT, handlePreferencesChange)

    return () => {
      window.removeEventListener(
        AI_MODEL_PREFERENCES_EVENT,
        handlePreferencesChange,
      )
    }
  }, [models])

  const persistPreferences = React.useCallback(
    async (nextPreferences: AiModelPreferences, previous: AiModelPreferences) => {
      setSaving(true)

      try {
        const response = await fetch('/api/ai/settings/models', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            defaultModelId: nextPreferences.activeModelId,
            enabledModelIds: nextPreferences.enabledModelIds,
          }),
        })

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const saved = (await response.json()) as {
          defaultModelId?: string
          enabledModelIds?: string[]
        }
        const normalized = sanitizeAiModelPreferences(
          {
            activeModelId: saved.defaultModelId ?? nextPreferences.activeModelId,
            enabledModelIds:
              saved.enabledModelIds ?? nextPreferences.enabledModelIds,
          },
          models,
        )

        preferencesRef.current = normalized
        setPreferences(normalized)
        dispatchPreferencesEvent(normalized)
      } catch (error) {
        preferencesRef.current = previous
        setPreferences(previous)
        toast.error('Unable to save AI model settings', {
          description:
            error instanceof Error ? error.message : 'Please try again.',
        })
      } finally {
        setSaving(false)
      }
    },
    [models],
  )

  const updatePreferences = React.useCallback(
    (updater: (current: AiModelPreferences) => AiModelPreferences) => {
      const currentPreferences = preferencesRef.current
      const nextPreferences = sanitizeAiModelPreferences(
        updater(currentPreferences),
        models,
      )

      if (arePreferencesEqual(currentPreferences, nextPreferences)) {
        return
      }

      preferencesRef.current = nextPreferences
      setPreferences(nextPreferences)
      dispatchPreferencesEvent(nextPreferences)
      void persistPreferences(nextPreferences, currentPreferences)
    },
    [models, persistPreferences],
  )

  const toggleModel = React.useCallback(
    (modelId: string, enabled: boolean) => {
      updatePreferences((current) => {
        const enabledIds = enabled
          ? Array.from(new Set([...current.enabledModelIds, modelId]))
          : current.enabledModelIds.filter((value) => value !== modelId)

        return {
          activeModelId:
            current.activeModelId === modelId && !enabled
              ? enabledIds[0] ?? null
              : current.activeModelId ?? enabledIds[0] ?? null,
          enabledModelIds: enabledIds,
        }
      })
    },
    [updatePreferences],
  )

  const setActiveModelId = React.useCallback(
    (modelId: string) => {
      updatePreferences((current) => {
        const enabledIds = current.enabledModelIds.includes(modelId)
          ? current.enabledModelIds
          : [...current.enabledModelIds, modelId]

        return {
          activeModelId: modelId,
          enabledModelIds: enabledIds,
        }
      })
    },
    [updatePreferences],
  )

  const resetToDefault = React.useCallback(() => {
    const nextPreferences = getInitialPreferences(
      models,
      defaultModelId,
      initialEnabledModelIds,
    )

    if (arePreferencesEqual(preferencesRef.current, nextPreferences)) {
      return
    }

    const previous = preferencesRef.current
    preferencesRef.current = nextPreferences
    setPreferences(nextPreferences)
    dispatchPreferencesEvent(nextPreferences)
    void persistPreferences(nextPreferences, previous)
  }, [defaultModelId, initialEnabledModelIds, models, persistPreferences])

  const enabledModels = React.useMemo(() => {
    const positionById = new Map(
      preferences.enabledModelIds.map((value, index) => [value, index]),
    )

    return models
      .filter((model) => positionById.has(model.id))
      .sort(
        (left, right) =>
          (positionById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (positionById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
      )
  }, [models, preferences.enabledModelIds])

  const activeModel =
    models.find((model) => model.id === preferences.activeModelId) ?? null

  return {
    preferences,
    enabledModels,
    activeModel,
    activeModelId: preferences.activeModelId,
    enabledModelIds: preferences.enabledModelIds,
    saving,
    toggleModel,
    setActiveModelId,
    resetToDefault,
  }
}
