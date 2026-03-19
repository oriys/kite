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

export interface KnowledgeSourceImportableDocument {
  id: string
  title: string
  slug: string | null
  status: 'draft' | 'review' | 'published' | 'archived'
  preview: string
  updatedAt: string
}

export interface KnowledgeSourceImportableOpenApi {
  id: string
  name: string
  sourceType: 'upload' | 'url'
  sourceUrl: string | null
  parsedVersion: string | null
  openapiVersion: string | null
  createdAt: string
  lastSyncedAt: string | null
}

export interface KnowledgeSourceImportables {
  documents: KnowledgeSourceImportableDocument[]
  openapiSources: KnowledgeSourceImportableOpenApi[]
}

export interface KnowledgeSourceFormValues {
  title: string
  sourceType: KnowledgeSourceItem['sourceType']
  sourceUrl: string
  sourceUrlsText: string
  rawContent: string
  file: File | null
  sourceOrigin: 'manual' | 'workspace'
  workspaceImportIds: string[]
}

function normalizeCreatedSourcesResponse(payload: unknown): KnowledgeSourceItem[] {
  if (
    payload
    && typeof payload === 'object'
    && 'items' in payload
    && Array.isArray((payload as { items?: unknown }).items)
  ) {
    return (payload as { items: KnowledgeSourceItem[] }).items
  }

  if (Array.isArray(payload)) {
    return payload as KnowledgeSourceItem[]
  }

  return payload && typeof payload === 'object' && 'id' in payload
    ? [payload as KnowledgeSourceItem]
    : []
}

export function parseKnowledgeSourceUrlLines(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  )
}

export function createDefaultKnowledgeSourceFormValues(): KnowledgeSourceFormValues {
  return {
    title: '',
    sourceType: 'markdown',
    sourceUrl: '',
    sourceUrlsText: '',
    rawContent: '',
    file: null,
    sourceOrigin: 'manual',
    workspaceImportIds: [],
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
  const [importables, setImportables] = React.useState<KnowledgeSourceImportables>({
    documents: [],
    openapiSources: [],
  })
  const [importablesError, setImportablesError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadingImportables, setLoadingImportables] = React.useState(true)
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

  const fetchImportables = React.useCallback(async () => {
    const response = await fetch('/api/ai/knowledge-sources/importable', {
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(await parseResponseError(response))
    }

    return (await response.json()) as KnowledgeSourceImportables
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

  React.useEffect(() => {
    let cancelled = false

    setLoadingImportables(true)
    void fetchImportables()
      .then((nextImportables) => {
        if (cancelled) return
        setImportables(nextImportables)
        setImportablesError(null)
      })
      .catch((nextError) => {
        if (cancelled) return
        setImportables({ documents: [], openapiSources: [] })
        setImportablesError(
          nextError instanceof Error
            ? nextError.message
            : 'Unable to load workspace import options',
        )
      })
      .finally(() => {
        if (cancelled) return
        setLoadingImportables(false)
      })

    return () => {
      cancelled = true
    }
  }, [fetchImportables])

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

        if (values.file && values.sourceOrigin !== 'workspace') {
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
              sourceOrigin: values.sourceOrigin,
              sourceUrl: values.sourceUrl,
              workspaceImportIds:
                values.sourceOrigin === 'workspace'
                  ? values.workspaceImportIds
                  : undefined,
              sourceUrls:
                values.sourceType === 'url'
                  ? parseKnowledgeSourceUrlLines(values.sourceUrlsText)
                  : undefined,
              rawContent: values.rawContent,
            }),
          })
        }

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const source = normalizeCreatedSourcesResponse(await response.json())
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
    importables,
    importablesError,
    loading,
    loadingImportables,
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
