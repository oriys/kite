'use client'

import * as React from 'react'
import { docs, type Doc, type DocStatus } from '@/lib/documents'

export function useDocuments(statusFilter?: DocStatus) {
  const [items, setItems] = React.useState<Doc[]>([])
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(() => {
    setItems(docs.list(statusFilter))
    setLoading(false)
  }, [statusFilter])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const create = React.useCallback(
    (title: string, content?: string) => {
      const doc = docs.create(title, content)
      refresh()
      return doc
    },
    [refresh],
  )

  const remove = React.useCallback(
    (id: string) => {
      docs.remove(id)
      refresh()
    },
    [refresh],
  )

  return { items, loading, refresh, create, remove }
}

export function useDocument(id?: string | null) {
  const [doc, setDoc] = React.useState<Doc | undefined>(undefined)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(() => {
    if (!id) {
      setDoc(undefined)
      setLoading(false)
      return
    }
    setDoc(docs.get(id))
    setLoading(false)
  }, [id])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const update = React.useCallback(
    (patch: Partial<Pick<Doc, 'title' | 'content'>>) => {
      if (!id) return undefined
      const updated = docs.update(id, patch)
      if (updated) setDoc(updated)
      return updated
    },
    [id],
  )

  const transition = React.useCallback(
    (status: DocStatus) => {
      if (!id) return undefined
      const updated = docs.transition(id, status)
      if (updated) setDoc(updated)
      return updated
    },
    [id],
  )

  const remove = React.useCallback(() => {
    if (!id) return false
    return docs.remove(id)
  }, [id])

  const duplicate = React.useCallback(() => {
    if (!id) return undefined
    return docs.duplicate(id)
  }, [id])

  return { doc, loading, update, transition, remove, duplicate, refresh }
}
