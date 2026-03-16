'use client'

import * as React from 'react'

import type { WorkspaceCliSkillListItem } from '@/lib/queries/skills'
import type { CliSkillCatalogItem } from '@/lib/skill-catalog'

export interface CliSkillCatalogListItem extends CliSkillCatalogItem {
  installed: boolean
  installedSkill: WorkspaceCliSkillListItem | null
}

async function parseResponseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string'
    ? body.error
    : 'Unable to update workspace CLI skills'
}

export function useSkills() {
  const [items, setItems] = React.useState<WorkspaceCliSkillListItem[]>([])
  const [catalog, setCatalog] = React.useState<CliSkillCatalogListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [mutating, setMutating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)

    try {
      const [skillsResponse, catalogResponse] = await Promise.all([
        fetch('/api/ai/skills', { cache: 'no-store' }),
        fetch('/api/ai/skills/catalog', { cache: 'no-store' }),
      ])

      if (!skillsResponse.ok) {
        throw new Error(await parseResponseError(skillsResponse))
      }
      if (!catalogResponse.ok) {
        throw new Error(await parseResponseError(catalogResponse))
      }

      const [nextItems, nextCatalog] = await Promise.all([
        skillsResponse.json() as Promise<WorkspaceCliSkillListItem[]>,
        catalogResponse.json() as Promise<CliSkillCatalogListItem[]>,
      ])

      setItems(nextItems)
      setCatalog(nextCatalog)
      setError(null)
      return { items: nextItems, catalog: nextCatalog }
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : 'Unable to load workspace CLI skills'
      setError(message)
      throw nextError
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh().catch(() => undefined)
  }, [refresh])

  const installSkill = React.useCallback(
    async (slug: string, enabled = true) => {
      setMutating(true)

      try {
        const response = await fetch('/api/ai/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, enabled }),
        })

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const skill = (await response.json()) as WorkspaceCliSkillListItem
        await refresh().catch(() => undefined)
        return skill
      } finally {
        setMutating(false)
      }
    },
    [refresh],
  )

  const updateSkill = React.useCallback(
    async (id: string, updates: { enabled?: boolean; prompt?: string }) => {
      setMutating(true)

      try {
        const response = await fetch(`/api/ai/skills/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const skill = (await response.json()) as WorkspaceCliSkillListItem
        await refresh().catch(() => undefined)
        return skill
      } finally {
        setMutating(false)
      }
    },
    [refresh],
  )

  const uninstallSkill = React.useCallback(
    async (id: string) => {
      setMutating(true)

      try {
        const response = await fetch(`/api/ai/skills/${id}`, {
          method: 'DELETE',
        })

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

  const toggleSkill = React.useCallback(
    async (id: string, enabled: boolean) =>
      updateSkill(id, { enabled }),
    [updateSkill],
  )

  return {
    items,
    catalog,
    loading,
    mutating,
    error,
    refresh,
    installSkill,
    updateSkill,
    uninstallSkill,
    toggleSkill,
  }
}
