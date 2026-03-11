'use client'

import * as React from 'react'

import {
  createFallbackDocSnippets,
  sortStoredDocSnippets,
  type DocSnippetMutation,
  type StoredDocSnippet,
} from '@/lib/doc-snippets'

function normalizeStoredDocSnippet(raw: Record<string, unknown>): StoredDocSnippet {
  return {
    id: String(raw.id),
    label: String(raw.label),
    description: String(raw.description),
    category: raw.category as StoredDocSnippet['category'],
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords.map((keyword) => String(keyword))
      : [],
    template: String(raw.template),
    workspaceId: String(raw.workspaceId ?? ''),
    sortOrder: Number(raw.sortOrder ?? 0),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

function normalizeStoredDocSnippetList(raw: unknown[]) {
  return sortStoredDocSnippets(
    raw.map((snippet) => normalizeStoredDocSnippet(snippet as Record<string, unknown>)),
  )
}

async function parseResponseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : 'Request failed'
}

export function useDocSnippets() {
  const [items, setItems] = React.useState<StoredDocSnippet[]>(() => createFallbackDocSnippets())
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/doc-snippets', { cache: 'no-store' })

      if (response.ok) {
        const data = await response.json()
        setItems(normalizeStoredDocSnippetList(data))
        setError(null)
      } else {
        setError(await parseResponseError(response))
      }
    } catch {
      setError('Unable to reach the component library')
    }

    setLoading(false)
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const create = React.useCallback(async (input: DocSnippetMutation) => {
    const response = await fetch('/api/doc-snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      throw new Error(await parseResponseError(response))
    }

    const created = normalizeStoredDocSnippet(await response.json())
    setItems((previous) => sortStoredDocSnippets([...previous, created]))
    setError(null)
    return created
  }, [])

  const update = React.useCallback(
    async (id: string, patch: Partial<DocSnippetMutation>) => {
      const response = await fetch(`/api/doc-snippets/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!response.ok) {
        throw new Error(await parseResponseError(response))
      }

      const updated = normalizeStoredDocSnippet(await response.json())
      setItems((previous) =>
        sortStoredDocSnippets(previous.map((item) => (item.id === id ? updated : item))),
      )
      setError(null)
      return updated
    },
    [],
  )

  const remove = React.useCallback(async (id: string) => {
    const response = await fetch(`/api/doc-snippets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(await parseResponseError(response))
    }

    setItems((previous) => previous.filter((item) => item.id !== id))
    setError(null)
  }, [])

  return {
    items,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
  }
}
