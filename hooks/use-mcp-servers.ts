'use client'

import * as React from 'react'

import type { McpServerFormValues } from '@/lib/ai'
import {
  normalizeMcpServerConfigList,
  normalizeMcpServerConfigListItem,
  normalizeMcpServerConnectionTestResult,
  type McpServerConfigListItem,
} from '@/lib/mcp-server-config'

async function parseResponseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string'
    ? body.error
    : 'Unable to update MCP servers'
}

export function useMcpServers() {
  const [items, setItems] = React.useState<McpServerConfigListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [mutating, setMutating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/ai/mcp-servers', {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(await parseResponseError(response))
      }

      const nextItems = normalizeMcpServerConfigList(await response.json())
      setItems(nextItems)
      setError(null)
      return nextItems
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : 'Unable to load MCP servers'
      setError(message)
      throw nextError
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh().catch(() => undefined)
  }, [refresh])

  const createServer = React.useCallback(
    async (values: McpServerFormValues) => {
      setMutating(true)

      try {
        const response = await fetch('/api/ai/mcp-servers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const server = normalizeMcpServerConfigListItem(await response.json())
        await refresh().catch(() => undefined)
        return server
      } finally {
        setMutating(false)
      }
    },
    [refresh],
  )

  const updateServer = React.useCallback(
    async (id: string, values: McpServerFormValues) => {
      setMutating(true)

      try {
        const response = await fetch(`/api/ai/mcp-servers/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const server = normalizeMcpServerConfigListItem(await response.json())
        await refresh().catch(() => undefined)
        return server
      } finally {
        setMutating(false)
      }
    },
    [refresh],
  )

  const deleteServer = React.useCallback(
    async (id: string) => {
      setMutating(true)

      try {
        const response = await fetch(`/api/ai/mcp-servers/${encodeURIComponent(id)}`, {
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

  const toggleServer = React.useCallback(
    async (id: string, enabled: boolean) => {
      setMutating(true)

      try {
        const response = await fetch(`/api/ai/mcp-servers/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
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

  const testConnection = React.useCallback(
    async (id: string) => {
      const response = await fetch(
        `/api/ai/mcp-servers/${encodeURIComponent(id)}/test`,
        {
          method: 'POST',
        },
      )

      if (!response.ok) {
        throw new Error(await parseResponseError(response))
      }

      return normalizeMcpServerConnectionTestResult(await response.json())
    },
    [],
  )

  return {
    items,
    loading,
    mutating,
    error,
    refresh,
    createServer,
    updateServer,
    deleteServer,
    toggleServer,
    testConnection,
  }
}
