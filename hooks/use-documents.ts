'use client'

import * as React from 'react'
import { type Doc, type DocStatus } from '@/lib/documents'

export function useDocuments(statusFilter?: DocStatus) {
  const [items, setItems] = React.useState<Doc[]>([])
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    const params = statusFilter ? `?status=${statusFilter}` : ''
    const res = await fetch(`/api/documents${params}`)
    if (res.ok) {
      const data = await res.json()
      setItems(normalizeDocList(data))
    }
    setLoading(false)
  }, [statusFilter])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const create = React.useCallback(
    async (title: string, content?: string): Promise<Doc> => {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: content ?? '' }),
      })
      const doc = normalizeDoc(await res.json())
      setItems((prev) => [doc, ...prev])
      return doc
    },
    [],
  )

  const remove = React.useCallback(
    async (id: string) => {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((d) => d.id !== id))
    },
    [],
  )

  return { items, loading, refresh, create, remove }
}

export function useDocument(id?: string | null) {
  const [doc, setDoc] = React.useState<Doc | undefined>(undefined)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    if (!id) {
      setDoc(undefined)
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await fetch(`/api/documents/${id}`)
    if (res.ok) {
      setDoc(normalizeDoc(await res.json()))
    } else {
      setDoc(undefined)
    }
    setLoading(false)
  }, [id])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const update = React.useCallback(
    async (patch: Partial<Pick<Doc, 'title' | 'content'>>) => {
      if (!id) return undefined
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = normalizeDoc(await res.json())
        setDoc(updated)
        return updated
      }
      return undefined
    },
    [id],
  )

  const transition = React.useCallback(
    async (status: DocStatus) => {
      if (!id) return undefined
      const res = await fetch(`/api/documents/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const updated = normalizeDoc(await res.json())
        setDoc(updated)
        return updated
      }
      return undefined
    },
    [id],
  )

  const remove = React.useCallback(async () => {
    if (!id) return false
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    return res.ok
  }, [id])

  const duplicate = React.useCallback(async () => {
    if (!id) return undefined
    const res = await fetch(`/api/documents/${id}/duplicate`, {
      method: 'POST',
    })
    if (res.ok) {
      return normalizeDoc(await res.json())
    }
    return undefined
  }, [id])

  return { doc, loading, update, transition, remove, duplicate, refresh }
}

// Normalize API response dates to ISO strings for consistency
function normalizeDoc(raw: Record<string, unknown>): Doc {
  return {
    id: raw.id as string,
    title: raw.title as string,
    content: raw.content as string,
    status: raw.status as DocStatus,
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
    workspaceId: raw.workspaceId as string,
    createdBy: (raw.createdBy as string) ?? null,
    versions: Array.isArray(raw.versions)
      ? raw.versions.map((v: Record<string, unknown>) => ({
          id: String(v.id),
          content: String(v.content),
          savedAt: String(v.savedAt),
          wordCount: Number(v.wordCount),
        }))
      : [],
  }
}

function normalizeDocList(raw: unknown[]): Doc[] {
  return raw.map((d) => normalizeDoc(d as Record<string, unknown>))
}
