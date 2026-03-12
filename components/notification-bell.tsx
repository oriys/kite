'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCheck,
  MessageSquare,
  AtSign,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotifications } from '@/hooks/use-notifications'

const typeIcons: Record<string, typeof Bell> = {
  comment: MessageSquare,
  mention: AtSign,
  approval_request: ShieldCheck,
  approval_decision: ShieldCheck,
  status_change: ArrowRight,
  webhook_failure: AlertTriangle,
  system: Bell,
}

export function NotificationBell() {
  const router = useRouter()
  const { items, unreadCount, loading, markRead, markAllRead } =
    useNotifications()
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={markAllRead}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {items.map((n) => {
                const Icon = typeIcons[n.type] ?? Bell
                return (
                  <button
                    key={n.id}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                      !n.isRead && 'bg-accent/5',
                    )}
                    onClick={() => {
                      if (!n.isRead) markRead(n.id)
                      if (n.linkUrl) {
                        router.push(n.linkUrl)
                        setOpen(false)
                      }
                    }}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        n.isRead
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-accent/10 text-accent-foreground',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug font-medium">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                    {!n.isRead && (
                      <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}
