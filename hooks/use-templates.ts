'use client'

import * as React from 'react'

import {
  normalizeTemplate,
  normalizeTemplateList,
  type Template,
  type TemplateCategory,
} from '@/lib/templates'

export function useTemplates(category?: TemplateCategory | null) {
  const [items, setItems] = React.useState<Template[]>([])
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      const qs = params.toString()
      const res = await fetch(`/api/templates${qs ? `?${qs}` : ''}`)
      if (res.ok) {
        const data = normalizeTemplateList(await res.json())
        setItems(data)
        return data
      }
      return []
    } finally {
      setLoading(false)
    }
  }, [category])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const create = React.useCallback(
    async (input: {
      name: string
      description?: string
      category?: TemplateCategory
      content?: string
    }) => {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name,
          description: input.description ?? '',
          category: input.category ?? 'custom',
          content: input.content ?? '',
        }),
      })

      if (!res.ok) return undefined

      const template = normalizeTemplate(await res.json())
      setItems((prev) => [template, ...prev])
      return template
    },
    [],
  )

  const remove = React.useCallback(async (id: string) => {
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    if (!res.ok) return false
    setItems((prev) => prev.filter((item) => item.id !== id))
    return true
  }, [])

  const duplicate = React.useCallback(async (id: string) => {
    const res = await fetch(`/api/templates/${id}/duplicate`, { method: 'POST' })
    if (!res.ok) return undefined

    const template = normalizeTemplate(await res.json())
    setItems((prev) => [template, ...prev])
    return template
  }, [])

  return { items, loading, refresh, create, remove, duplicate }
}

export function useTemplate(id?: string | null) {
  const [template, setTemplate] = React.useState<Template | undefined>(undefined)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    if (!id) {
      setTemplate(undefined)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/templates/${id}`)
      if (res.ok) {
        setTemplate(normalizeTemplate(await res.json()))
      } else {
        setTemplate(undefined)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const update = React.useCallback(
    async (patch: Partial<Pick<Template, 'name' | 'description' | 'category' | 'content' | 'thumbnail'>>) => {
      if (!id) return undefined

      const res = await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!res.ok) return undefined

      const updated = normalizeTemplate(await res.json())
      setTemplate(updated)
      return updated
    },
    [id],
  )

  const remove = React.useCallback(async () => {
    if (!id) return false
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    return res.ok
  }, [id])

  const duplicate = React.useCallback(async () => {
    if (!id) return undefined
    const res = await fetch(`/api/templates/${id}/duplicate`, { method: 'POST' })
    if (!res.ok) return undefined
    return normalizeTemplate(await res.json())
  }, [id])

  const createDocument = React.useCallback(
    async (title?: string) => {
      if (!id) return undefined
      const res = await fetch(`/api/templates/${id}/create-doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(title ? { title } : {}),
      })
      if (!res.ok) return undefined
      return (await res.json()) as { id: string; title: string }
    },
    [id],
  )

  return { template, loading, update, remove, duplicate, createDocument, refresh }
}
