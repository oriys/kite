'use client'

import * as React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface EditorPresence {
  userId: string
  userName: string | null
  userImage: string | null
  cursorPosition: number | null
  lastSeenAt: string
}

interface PresenceAvatarsProps {
  documentId: string
  currentUserId: string
  className?: string
}

const PRESENCE_COLORS = [
  'ring-blue-500',
  'ring-green-500',
  'ring-purple-500',
  'ring-orange-500',
  'ring-pink-500',
  'ring-cyan-500',
]

export function PresenceAvatars({
  documentId,
  currentUserId,
  className,
}: PresenceAvatarsProps) {
  const [editors, setEditors] = React.useState<EditorPresence[]>([])

  React.useEffect(() => {
    let active = true

    const heartbeat = async () => {
      try {
        await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId }),
        })
      } catch {}
    }

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/presence?documentId=${encodeURIComponent(documentId)}`,
        )
        if (res.ok && active) {
          const data = await res.json()
          setEditors(
            data.filter((e: EditorPresence) => e.userId !== currentUserId),
          )
        }
      } catch {}
    }

    heartbeat()
    poll()
    const hbInterval = setInterval(heartbeat, 15_000)
    const pollInterval = setInterval(poll, 10_000)

    return () => {
      active = false
      clearInterval(hbInterval)
      clearInterval(pollInterval)
      fetch(
        `/api/presence?documentId=${encodeURIComponent(documentId)}`,
        { method: 'DELETE' },
      ).catch((err) => {
        console.warn('[presence] Failed to clear presence on unmount:', err)
      })
    }
  }, [documentId, currentUserId])

  if (editors.length === 0) return null

  return (
    <TooltipProvider>
      <div className={cn('flex -space-x-2', className)}>
        {editors.slice(0, 5).map((editor, i) => (
          <Tooltip key={editor.userId}>
            <TooltipTrigger asChild>
              <Avatar
                className={cn(
                  'h-6 w-6 ring-2',
                  PRESENCE_COLORS[i % PRESENCE_COLORS.length],
                )}
              >
                <AvatarImage src={editor.userImage ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {(editor.userName ?? '?')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {editor.userName ?? 'Unknown'} is editing
            </TooltipContent>
          </Tooltip>
        ))}
        {editors.length > 5 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background">
            +{editors.length - 5}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
