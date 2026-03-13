'use client'

import * as React from 'react'
import { type Doc, type DocStatus } from '@/lib/documents'

export function useDocuments(
  statusFilter?: DocStatus,
  apiVersionId?: string | null,
  searchQuery?: string,
) {
  const [items, setItems] = React.useState<Doc[]>([])
  const [loading, setLoading] = React.useState(true)
  const requestIdRef = React.useRef(0)

  const refresh = React.useCallback(async (options: { silent?: boolean } = {}) => {
    const requestId = ++requestIdRef.current

    if (!options.silent) {
      setLoading(true)
    }

    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (apiVersionId) params.set('api_version_id', apiVersionId)
      if (searchQuery?.trim()) params.set('q', searchQuery.trim())
      const qs = params.toString()
      const res = await fetch(`/api/documents${qs ? `?${qs}` : ''}`)
      if (res.ok) {
        const data = normalizeDocList(await res.json())
        if (requestId === requestIdRef.current) {
          setItems(data)
        }
        return data
      }

      return []
    } finally {
      if (!options.silent && requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [statusFilter, apiVersionId, searchQuery])

  React.useEffect(() => {
    void refresh()
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
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) return false
      setItems((prev) => prev.filter((d) => d.id !== id))
      return true
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
      content: String(raw.content ?? ''),
      summary: String(raw.summary ?? ''),
      preview:
        raw.preview === undefined || raw.preview === null
          ? undefined
          : String(raw.preview),
      wordCount:
        raw.wordCount === undefined || raw.wordCount === null
          ? undefined
          : Number(raw.wordCount),
      status: raw.status as DocStatus,
      visibility: (raw.visibility as Doc['visibility']) ?? 'public',
      locale: (raw.locale as string) ?? null,
    apiVersionId: (raw.apiVersionId as string) ?? null,
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
    workspaceId: raw.workspaceId as string,
    createdBy: (raw.createdBy as string) ?? null,
    accessLevel: (raw.accessLevel as Doc['accessLevel']) ?? null,
    hasCustomPermissions: Boolean(raw.hasCustomPermissions),
    canEdit: raw.canEdit === undefined ? true : Boolean(raw.canEdit),
    canManagePermissions: Boolean(raw.canManagePermissions),
    canDelete: raw.canDelete === undefined ? true : Boolean(raw.canDelete),
    canDuplicate: raw.canDuplicate === undefined ? true : Boolean(raw.canDuplicate),
    canTransition: raw.canTransition === undefined ? true : Boolean(raw.canTransition),
    versionCount:
      raw.versionCount === undefined || raw.versionCount === null
        ? undefined
        : Number(raw.versionCount),
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
