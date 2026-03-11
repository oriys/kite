'use client'

import * as React from 'react'

import {
  type DocEvaluation,
  type DocEvaluationScore,
} from '@/lib/documents'

function normalizeEvaluation(raw: Record<string, unknown>): DocEvaluation {
  const creator =
    raw.creator && typeof raw.creator === 'object'
      ? (raw.creator as Record<string, unknown>)
      : null

  return {
    id: String(raw.id),
    score: Number(raw.score) as DocEvaluationScore,
    body: String(raw.body ?? ''),
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

export function useDocumentEvaluations(documentId?: string | null) {
  const [items, setItems] = React.useState<DocEvaluation[]>([])
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
      const response = await fetch(`/api/documents/${documentId}/evaluations`)
      const payload = (await parseJsonOrThrow(response)) as unknown[]
      setItems(payload.map((item) => normalizeEvaluation(item as Record<string, unknown>)))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load evaluations')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const create = React.useCallback(
    async (input: { score: DocEvaluationScore; body: string }) => {
      if (!documentId) return null

      const response = await fetch(`/api/documents/${documentId}/evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })

      const payload = (await parseJsonOrThrow(response)) as Record<string, unknown>
      const evaluation = normalizeEvaluation(payload)
      setItems((previous) => [evaluation, ...previous])
      return evaluation
    },
    [documentId],
  )

  const update = React.useCallback(
    async (
      evaluationId: string,
      patch: {
        score?: DocEvaluationScore
        body?: string
      },
    ) => {
      if (!documentId) return null

      const response = await fetch(
        `/api/documents/${documentId}/evaluations/${evaluationId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(patch),
        },
      )

      const payload = (await parseJsonOrThrow(response)) as Record<string, unknown>
      const evaluation = normalizeEvaluation(payload)
      setItems((previous) =>
        previous.map((item) => (item.id === evaluationId ? evaluation : item)),
      )
      return evaluation
    },
    [documentId],
  )

  const remove = React.useCallback(
    async (evaluationId: string) => {
      if (!documentId) return false

      const response = await fetch(
        `/api/documents/${documentId}/evaluations/${evaluationId}`,
        {
          method: 'DELETE',
        },
      )

      await parseJsonOrThrow(response)
      setItems((previous) => previous.filter((item) => item.id !== evaluationId))
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
