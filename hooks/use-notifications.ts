'use client'

import * as React from 'react'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  linkUrl: string | null
  isRead: boolean
  createdAt: string
}

export function useNotifications() {
  const [items, setItems] = React.useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=30')
      if (!res.ok) return
      const data = await res.json()
      setItems(data.items)
      setUnreadCount(data.unreadCount)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [refresh])

  const markRead = React.useCallback(
    async (id: string) => {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    },
    [],
  )

  const markAllRead = React.useCallback(async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }, [])

  return { items, unreadCount, loading, refresh, markRead, markAllRead }
}
