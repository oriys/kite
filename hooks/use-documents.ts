'use client'

import * as React from 'react'
import {
  createEmptyDocumentCounts,
  isDocStatus,
  type Doc,
  type DocStatus,
  type DocumentListCounts,
  type DocumentListPagination,
  type DocumentListResponse,
  type DocumentSort,
} from '@/lib/documents'

interface UseDocumentsOptions {
  page?: number
  pageSize?: number
  sort?: DocumentSort
  category?: string
}

export function useDocuments(
  statusFilter?: DocStatus,
  apiVersionId?: string | null,
  searchQuery?: string,
  options: UseDocumentsOptions = {},
) {
  const [items, setItems] = React.useState<Doc[]>([])
  const [loading, setLoading] = React.useState(true)
  const [counts, setCounts] = React.useState<DocumentListCounts>(
    createEmptyDocumentCounts(),
  )
  const [categories, setCategories] = React.useState<string[]>([])
  const [pagination, setPagination] = React.useState<DocumentListPagination>({
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 100,
    total: 0,
    totalPages: 1,
  })
  const requestIdRef = React.useRef(0)
  const page = options.page ?? 1
  const pageSize = options.pageSize ?? 100
  const sort = options.sort ?? 'updated_desc'
  const category = options.category?.trim() ?? ''

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
      if (category) params.set('category', category)
      params.set('page', String(page))
      params.set('page_size', String(pageSize))
      params.set('sort', sort)
      const qs = params.toString()
      const res = await fetch(`/api/documents${qs ? `?${qs}` : ''}`)
      if (res.ok) {
        const payload = normalizeDocCollection(await res.json(), page, pageSize)
        if (requestId === requestIdRef.current) {
          setItems(payload.items)
          setCounts(payload.counts)
          setCategories(payload.categories)
          setPagination(payload.pagination)
        }
        return payload.items
      }

      return []
    } finally {
      if (!options.silent && requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [apiVersionId, category, page, pageSize, searchQuery, sort, statusFilter])

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
      return normalizeDoc(await res.json())
    },
    [],
  )

  const remove = React.useCallback(
    async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) return false
      await refresh({ silent: true })
      return true
    },
    [refresh],
  )

  return { items, counts, categories, pagination, loading, refresh, create, remove }
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
    void refresh()
  }, [refresh])

  const update = React.useCallback(
    async (patch: Partial<Pick<Doc, 'title' | 'slug' | 'category' | 'content'>>) => {
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

function normalizeDoc(raw: Record<string, unknown>): Doc {
  const status = isDocStatus(raw.status) ? raw.status : 'draft'

  return {
    id: raw.id as string,
    title: raw.title as string,
    slug:
      raw.slug === undefined || raw.slug === null
        ? null
        : String(raw.slug),
    category: String(raw.category ?? ''),
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
    status,
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

function normalizeDocCollection(
  raw: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
): DocumentListResponse {
  if (Array.isArray(raw)) {
    const items = normalizeDocList(raw)
    const counts = items.reduce<DocumentListCounts>((acc, doc) => {
      acc.all += 1
      acc[doc.status] += 1
      return acc
    }, createEmptyDocumentCounts())

    return {
      items,
      counts,
      categories: [],
      pagination: {
        page: fallbackPage,
        pageSize: fallbackPageSize,
        total: items.length,
        totalPages: Math.max(1, Math.ceil(items.length / fallbackPageSize)),
      },
    }
  }

  const payload = raw as {
    items?: unknown[]
    counts?: Partial<DocumentListCounts>
    categories?: unknown[]
    pagination?: Partial<DocumentListPagination>
  }
  const items = Array.isArray(payload.items) ? normalizeDocList(payload.items) : []
  const counts = {
    ...createEmptyDocumentCounts(),
    ...(payload.counts ?? {}),
  }
  const pagination = {
    page: payload.pagination?.page ?? fallbackPage,
    pageSize: payload.pagination?.pageSize ?? fallbackPageSize,
    total: payload.pagination?.total ?? items.length,
    totalPages:
      payload.pagination?.totalPages ?? Math.max(1, Math.ceil(items.length / fallbackPageSize)),
  }

  return {
    items,
    counts,
    categories: Array.isArray(payload.categories)
      ? payload.categories.map((value) => String(value))
      : [],
    pagination,
  }
}
