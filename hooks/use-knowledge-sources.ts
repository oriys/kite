'use client'

import * as React from 'react'

export interface ProcessingProgress {
  progress: number
  stage: string
  detail?: string
}

export interface KnowledgeSourceItem {
  id: string
  sourceType: 'document' | 'pdf' | 'url' | 'markdown' | 'faq' | 'openapi' | 'graphql' | 'zip' | 'asyncapi' | 'protobuf' | 'rst' | 'asciidoc' | 'csv' | 'sql_ddl' | 'typescript_defs' | 'postman'
  status: 'pending' | 'processing' | 'cancelled' | 'ready' | 'error' | 'archived'
  title: string
  sourceUrl: string | null
  rawContent: string
  contentHash: string | null
  metadata: Record<string, unknown> | null
  errorMessage: string | null
  stopRequestedAt: string | null
  createdAt: string
  updatedAt: string
  processedAt: string | null
}

export interface KnowledgeSourceFormValues {
  title: string
  sourceType: KnowledgeSourceItem['sourceType']
  sourceUrl: string
  rawContent: string
  file: File | null
}

export function createDefaultKnowledgeSourceFormValues(): KnowledgeSourceFormValues {
  return {
    title: '',
    sourceType: 'markdown',
    sourceUrl: '',
    rawContent: '',
    file: null,
  }
}

export const KNOWLEDGE_SOURCE_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const POLL_INTERVAL_MS = 2500

export function getProcessingProgress(source: KnowledgeSourceItem): ProcessingProgress | null {
  if (source.status !== 'processing') return null
  const meta = source.metadata as Record<string, unknown> | null
  const proc = meta?._processing as ProcessingProgress | undefined
  if (!proc || typeof proc.progress !== 'number') return null
  return proc
}

async function parseResponseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string'
    ? body.error
    : 'Unable to update knowledge sources'
}

export function useKnowledgeSources() {
  const [items, setItems] = React.useState<KnowledgeSourceItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [mutating, setMutating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchItems = React.useCallback(async () => {
    const response = await fetch('/api/ai/knowledge-sources', {
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(await parseResponseError(response))
    }

    return (await response.json()) as KnowledgeSourceItem[]
  }, [])

  const refresh = React.useCallback(async () => {
    setLoading(true)

    try {
      const nextItems = await fetchItems()
      setItems(nextItems)
      setError(null)
      return nextItems
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : 'Unable to load knowledge sources'
      setError(message)
      throw nextError
    } finally {
      setLoading(false)
    }
  }, [fetchItems])

  React.useEffect(() => {
    void refresh().catch(() => undefined)
  }, [refresh])

  // Poll while any item is processing
  const hasProcessing = items.some((item) => item.status === 'processing')

  React.useEffect(() => {
    if (!hasProcessing) return

    const interval = setInterval(async () => {
      try {
        const nextItems = await fetchItems()
        setItems(nextItems)
      } catch {
        // Silently ignore polling errors
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [hasProcessing, fetchItems])

  const createSource = React.useCallback(
    async (values: KnowledgeSourceFormValues) => {
      setMutating(true)

      try {
        let response: Response

        if (values.file) {
          const formData = new FormData()
          formData.set('title', values.title)
          formData.set('sourceType', values.sourceType)
          formData.set('file', values.file)
          if (values.sourceUrl) formData.set('sourceUrl', values.sourceUrl)

          response = await fetch('/api/ai/knowledge-sources', {
            method: 'POST',
            body: formData,
          })
        } else {
          response = await fetch('/api/ai/knowledge-sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: values.title,
              sourceType: values.sourceType,
              sourceUrl: values.sourceUrl,
              rawContent: values.rawContent,
            }),
          })
        }

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const source: KnowledgeSourceItem = await response.json()
        await refresh().catch(() => undefined)
        return source
      } finally {
        setMutating(false)
      }
    },
    [refresh],
  )

  const updateSource = React.useCallback(
    async (id: string, values: Partial<KnowledgeSourceFormValues>) => {
      setMutating(true)

      try {
        const response = await fetch(
          `/api/ai/knowledge-sources/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          },
        )

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const source: KnowledgeSourceItem = await response.json()
        await refresh().catch(() => undefined)
        return source
      } finally {
        setMutating(false)
      }
    },
    [refresh],
  )

  const deleteSource = React.useCallback(
    async (id: string) => {
      setMutating(true)

      try {
        const response = await fetch(
          `/api/ai/knowledge-sources/${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
          },
        )

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

  const processSource = React.useCallback(
    async (id: string) => {
      // Optimistic: mark item as processing so polling starts immediately
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'processing' as const, stopRequestedAt: null }
            : item,
        ),
      )

      try {
        const response = await fetch(
          `/api/ai/knowledge-sources/${encodeURIComponent(id)}/process`,
          {
            method: 'POST',
          },
        )

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const result = await response.json()
        await refresh().catch(() => undefined)
        return result as { status: KnowledgeSourceItem['status']; chunkCount: number }
      } catch (error) {
        await refresh().catch(() => undefined)
        throw error
      }
    },
    [refresh],
  )

  const stopSource = React.useCallback(
    async (id: string) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                stopRequestedAt: item.stopRequestedAt ?? new Date().toISOString(),
              }
            : item,
        ),
      )

      try {
        const response = await fetch(
          `/api/ai/knowledge-sources/${encodeURIComponent(id)}/stop`,
          {
            method: 'POST',
          },
        )

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const result = await response.json()
        await refresh().catch(() => undefined)
        return result as { status: 'stopping' }
      } catch (error) {
        await refresh().catch(() => undefined)
        throw error
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
    createSource,
    updateSource,
    deleteSource,
    processSource,
    stopSource,
  }
}
