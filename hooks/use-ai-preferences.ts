'use client'

import * as React from 'react'
import {
  AI_MODEL_PREFERENCES_EVENT,
  AI_MODEL_PREFERENCES_STORAGE_KEY,
  createDefaultAiModelPreferences,
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
    left.enabledModelIds.every((value, index) => value === right.enabledModelIds[index])
  )
}

function readStoredPreferences() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(AI_MODEL_PREFERENCES_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<AiModelPreferences>
  } catch {
    return null
  }
}

function persistPreferences(nextPreferences: AiModelPreferences) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    AI_MODEL_PREFERENCES_STORAGE_KEY,
    JSON.stringify(nextPreferences),
  )
  window.dispatchEvent(new CustomEvent(AI_MODEL_PREFERENCES_EVENT))
}

export function useAiPreferences(
  models: AiCatalogModel[],
  defaultModelId?: string,
) {
  const [preferences, setPreferences] = React.useState<AiModelPreferences>(() =>
    createDefaultAiModelPreferences(models, defaultModelId),
  )
  const preferencesRef = React.useRef(preferences)

  React.useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  const syncPreferences = React.useCallback(() => {
    const storedPreferences = readStoredPreferences()
    const nextPreferences = storedPreferences
      ? sanitizeAiModelPreferences(storedPreferences, models)
      : createDefaultAiModelPreferences(models, defaultModelId)

    setPreferences((current) =>
      arePreferencesEqual(current, nextPreferences) ? current : nextPreferences,
    )

    if (
      !storedPreferences ||
      !arePreferencesEqual(
        sanitizeAiModelPreferences(storedPreferences, models),
        nextPreferences,
      )
    ) {
      persistPreferences(nextPreferences)
    }
  }, [defaultModelId, models])

  React.useEffect(() => {
    syncPreferences()
  }, [syncPreferences])

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key &&
        event.key !== AI_MODEL_PREFERENCES_STORAGE_KEY
      ) {
        return
      }

      syncPreferences()
    }

    const handleCustomEvent = () => {
      syncPreferences()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(AI_MODEL_PREFERENCES_EVENT, handleCustomEvent)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(AI_MODEL_PREFERENCES_EVENT, handleCustomEvent)
    }
  }, [syncPreferences])

  const updatePreferences = React.useCallback(
    (updater: (current: AiModelPreferences) => AiModelPreferences) => {
      const currentPreferences = preferencesRef.current
      const nextPreferences = updater(currentPreferences)

      if (arePreferencesEqual(currentPreferences, nextPreferences)) {
        return
      }

      preferencesRef.current = nextPreferences
      setPreferences(nextPreferences)
      persistPreferences(nextPreferences)
    },
    [],
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
    const nextPreferences = createDefaultAiModelPreferences(models, defaultModelId)
    preferencesRef.current = nextPreferences
    setPreferences(nextPreferences)
    persistPreferences(nextPreferences)
  }, [defaultModelId, models])

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
    toggleModel,
    setActiveModelId,
    resetToDefault,
  }
}
