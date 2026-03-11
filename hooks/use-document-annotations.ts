'use client'

import * as React from 'react'

import { type DocAnnotation, type DocAnnotationStatus } from '@/lib/documents'

function normalizeAnnotation(raw: Record<string, unknown>): DocAnnotation {
  const creator =
    raw.creator && typeof raw.creator === 'object'
      ? (raw.creator as Record<string, unknown>)
      : null

  return {
    id: String(raw.id),
    quote: String(raw.quote ?? ''),
    body: String(raw.body ?? ''),
    status: raw.status as DocAnnotationStatus,
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
    createdBy: raw.createdBy ? String(raw.createdBy) : null,
    creator: creator
      ? {
          id: creator.id ? String(creator.id) : null,
          name: creator.name ? String(creator.name) : null,
          email: creator.email ? String(creator.email) : null,
          image: creator.image ? String(creator.image) : null,
        }
      : null,
  }
}

async function parseJsonOrThrow(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | Record<string, unknown>
    | null

  if (!response.ok) {
    throw new Error(
      payload && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : 'Request failed',
    )
  }

  return payload
}

export function useDocumentAnnotations(documentId?: string | null) {
  const [items, setItems] = React.useState<DocAnnotation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    if (!documentId) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setItems([])

    try {
      const response = await fetch(`/api/documents/${documentId}/annotations`)
      const payload = (await parseJsonOrThrow(response)) as unknown[]
      setItems(payload.map((item) => normalizeAnnotation(item as Record<string, unknown>)))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load annotations')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const create = React.useCallback(
    async (input: { body: string; quote?: string }) => {
      if (!documentId) return null

      const response = await fetch(`/api/documents/${documentId}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })

      const payload = (await parseJsonOrThrow(response)) as Record<string, unknown>
      const annotation = normalizeAnnotation(payload)
      setItems((previous) => [annotation, ...previous])
      return annotation
    },
    [documentId],
  )

  const update = React.useCallback(
    async (
      annotationId: string,
      patch: {
        body?: string
        status?: DocAnnotationStatus
      },
    ) => {
      if (!documentId) return null

      const response = await fetch(
        `/api/documents/${documentId}/annotations/${annotationId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(patch),
        },
      )

      const payload = (await parseJsonOrThrow(response)) as Record<string, unknown>
      const annotation = normalizeAnnotation(payload)
      setItems((previous) =>
        previous.map((item) => (item.id === annotationId ? annotation : item)),
      )
      return annotation
    },
    [documentId],
  )

  const remove = React.useCallback(
    async (annotationId: string) => {
      if (!documentId) return false

      const response = await fetch(
        `/api/documents/${documentId}/annotations/${annotationId}`,
        {
          method: 'DELETE',
        },
      )

      await parseJsonOrThrow(response)
      setItems((previous) => previous.filter((item) => item.id !== annotationId))
      return true
    },
    [documentId],
  )

  return {
    items,
    loading,
    error,
    create,
    update,
    remove,
    refresh,
  }
}
