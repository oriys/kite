'use client'

import * as React from 'react'
import { toast } from 'sonner'

import {
  mergeNavOrder,
  mergePersonalFeatureVisibility,
  type NavItemKey,
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
  navOrder: NavItemKey[]
  isUpdatingNavOrder: boolean
  updateNavOrder: (navOrder: NavItemKey[] | null) => Promise<boolean>
}

const PersonalSettingsContext =
  React.createContext<PersonalSettingsContextValue | null>(null)

export function PersonalSettingsProvider({
  children,
  initialFeatureVisibility,
  initialNavOrder,
}: {
  children: React.ReactNode
  initialFeatureVisibility: PersonalFeatureVisibility
  initialNavOrder?: NavItemKey[]
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

  const [navOrder, setNavOrder] = React.useState<NavItemKey[]>(() =>
    mergeNavOrder(initialNavOrder),
  )
  const navOrderRef = React.useRef(navOrder)
  const [isUpdatingNavOrder, setIsUpdatingNavOrder] = React.useState(false)

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

  const updateNavOrder = React.useCallback(
    async (nextNavOrder: NavItemKey[] | null) => {
      if (isUpdatingNavOrder) {
        return false
      }

      const previousNavOrder = navOrderRef.current
      const resolvedNavOrder = mergeNavOrder(nextNavOrder)

      navOrderRef.current = resolvedNavOrder
      setNavOrder(resolvedNavOrder)
      setIsUpdatingNavOrder(true)

      try {
        const response = await fetch('/api/personal-settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ navOrder: nextNavOrder }),
        })

        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            typeof payload?.error === 'string'
              ? payload.error
              : 'Failed to update navigation order.',
          )
        }

        const serverNavOrder = mergeNavOrder(payload?.navOrder)
        navOrderRef.current = serverNavOrder
        setNavOrder(serverNavOrder)
        return true
      } catch (error) {
        navOrderRef.current = previousNavOrder
        setNavOrder(previousNavOrder)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to update navigation order.',
        )
        return false
      } finally {
        setIsUpdatingNavOrder(false)
      }
    },
    [isUpdatingNavOrder],
  )

  const value = React.useMemo(
    () => ({
      featureVisibility,
      isUpdatingFeatureVisibility,
      pendingFeatureIds,
      updateFeatureVisibility,
      navOrder,
      isUpdatingNavOrder,
      updateNavOrder,
    }),
    [
      featureVisibility,
      isUpdatingFeatureVisibility,
      pendingFeatureIds,
      updateFeatureVisibility,
      navOrder,
      isUpdatingNavOrder,
      updateNavOrder,
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
