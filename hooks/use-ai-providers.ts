'use client'

import * as React from 'react'

import type { AiProviderConfigListItem, AiProviderFormValues } from '@/lib/ai'

async function parseResponseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string'
    ? body.error
    : 'Unable to update AI providers'
}

export function useAiProviders() {
  const [items, setItems] = React.useState<AiProviderConfigListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [mutating, setMutating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/ai/providers', {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(await parseResponseError(response))
      }

      const nextItems = (await response.json()) as AiProviderConfigListItem[]
      setItems(nextItems)
      setError(null)
      return nextItems
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : 'Unable to load AI providers'
      setError(message)
      throw nextError
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh().catch(() => undefined)
  }, [refresh])

  const createProvider = React.useCallback(
    async (values: AiProviderFormValues) => {
      setMutating(true)

      try {
        const response = await fetch('/api/ai/providers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        })

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const provider = (await response.json()) as AiProviderConfigListItem
        await refresh().catch(() => undefined)
        return provider
      } finally {
        setMutating(false)
      }
    },
    [refresh],
  )

  const updateProvider = React.useCallback(
    async (id: string, values: AiProviderFormValues) => {
      setMutating(true)

      try {
        const response = await fetch(`/api/ai/providers/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        })

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const provider = (await response.json()) as AiProviderConfigListItem
        await refresh().catch(() => undefined)
        return provider
      } finally {
        setMutating(false)
      }
    },
    [refresh],
  )

  const deleteProvider = React.useCallback(
    async (id: string) => {
      setMutating(true)

      try {
        const response = await fetch(`/api/ai/providers/${id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        await refresh().catch(() => undefined)
      } finally {
        setMutating(false)
      }
    },
    [refresh],
  )

  return {
    items,
    loading,
    mutating,
    error,
    refresh,
    createProvider,
    updateProvider,
    deleteProvider,
  }
}
