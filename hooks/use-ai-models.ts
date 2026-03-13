'use client'

import * as React from 'react'
import {
  sortAiCatalogModels,
  type AiModelCatalogResponse,
} from '@/lib/ai'

async function parseResponseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : 'Unable to load AI models'
}

function normalizeCatalogResponse(
  raw: AiModelCatalogResponse,
): AiModelCatalogResponse {
  return {
    ...raw,
    models: sortAiCatalogModels(raw.models, raw.defaultModelId),
  }
}

export function useAiModels() {
  const [catalog, setCatalog] = React.useState<AiModelCatalogResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/ai/models', { cache: 'no-store' })

      if (!response.ok) {
        throw new Error(await parseResponseError(response))
      }

      const nextCatalog = normalizeCatalogResponse(
        (await response.json()) as AiModelCatalogResponse,
      )

      setCatalog(nextCatalog)
      setError(nextCatalog.error ?? null)
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Unable to load AI models',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    catalog,
    items: catalog?.models ?? [],
    configured: catalog?.configured ?? false,
    providers: catalog?.providers ?? [],
    defaultModelId: catalog?.defaultModelId ?? '',
    enabledModelIds: catalog?.enabledModelIds ?? [],
    fetchedAt: catalog?.fetchedAt ?? '',
    loading,
    error,
    refresh,
  }
}
