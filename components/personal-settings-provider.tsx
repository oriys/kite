'use client'

import * as React from 'react'
import { toast } from 'sonner'

import {
  mergePersonalFeatureVisibility,
  type PersonalFeatureId,
  type PersonalFeatureVisibility,
} from '@/lib/personal-settings'

interface PersonalSettingsContextValue {
  featureVisibility: PersonalFeatureVisibility
  isUpdatingFeatureVisibility: boolean
  pendingFeatureIds: PersonalFeatureId[]
  updateFeatureVisibility: (
    updates: Partial<PersonalFeatureVisibility>,
  ) => Promise<boolean>
}

const PersonalSettingsContext =
  React.createContext<PersonalSettingsContextValue | null>(null)

export function PersonalSettingsProvider({
  children,
  initialFeatureVisibility,
}: {
  children: React.ReactNode
  initialFeatureVisibility: PersonalFeatureVisibility
}) {
  const [featureVisibility, setFeatureVisibility] =
    React.useState<PersonalFeatureVisibility>(() =>
      mergePersonalFeatureVisibility(initialFeatureVisibility),
    )
  const featureVisibilityRef = React.useRef(featureVisibility)
  const [isUpdatingFeatureVisibility, setIsUpdatingFeatureVisibility] =
    React.useState(false)
  const [pendingFeatureIds, setPendingFeatureIds] = React.useState<
    PersonalFeatureId[]
  >([])

  const updateFeatureVisibility = React.useCallback(
    async (updates: Partial<PersonalFeatureVisibility>) => {
      if (isUpdatingFeatureVisibility) {
        return false
      }

      const changedEntries = Object.entries(updates).filter(
        ([featureId, enabled]) =>
          typeof enabled === 'boolean' &&
          featureVisibilityRef.current[
            featureId as PersonalFeatureId
          ] !== enabled,
      ) as Array<[PersonalFeatureId, boolean]>

      if (changedEntries.length === 0) {
        return true
      }

      const nextUpdates = Object.fromEntries(changedEntries)
      const previousFeatureVisibility = featureVisibilityRef.current
      const nextFeatureVisibility = mergePersonalFeatureVisibility({
        ...previousFeatureVisibility,
        ...nextUpdates,
      })

      featureVisibilityRef.current = nextFeatureVisibility
      setFeatureVisibility(nextFeatureVisibility)
      setIsUpdatingFeatureVisibility(true)
      setPendingFeatureIds(changedEntries.map(([featureId]) => featureId))

      try {
        const response = await fetch('/api/personal-settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(nextUpdates),
        })

        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            typeof payload?.error === 'string'
              ? payload.error
              : 'Failed to update your personal settings.',
          )
        }

        const resolvedFeatureVisibility =
          mergePersonalFeatureVisibility(payload)

        featureVisibilityRef.current = resolvedFeatureVisibility
        setFeatureVisibility(resolvedFeatureVisibility)
        return true
      } catch (error) {
        featureVisibilityRef.current = previousFeatureVisibility
        setFeatureVisibility(previousFeatureVisibility)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to update your personal settings.',
        )
        return false
      } finally {
        setIsUpdatingFeatureVisibility(false)
        setPendingFeatureIds([])
      }
    },
    [isUpdatingFeatureVisibility],
  )

  const value = React.useMemo(
    () => ({
      featureVisibility,
      isUpdatingFeatureVisibility,
      pendingFeatureIds,
      updateFeatureVisibility,
    }),
    [
      featureVisibility,
      isUpdatingFeatureVisibility,
      pendingFeatureIds,
      updateFeatureVisibility,
    ],
  )

  return (
    <PersonalSettingsContext.Provider value={value}>
      {children}
    </PersonalSettingsContext.Provider>
  )
}

export function usePersonalSettings() {
  const context = React.useContext(PersonalSettingsContext)

  if (!context) {
    throw new Error(
      'usePersonalSettings must be used within a PersonalSettingsProvider.',
    )
  }

  return context
}
