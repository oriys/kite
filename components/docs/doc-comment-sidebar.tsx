'use client'

import { useState, useEffect, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Check,
  CornerDownRight,
  CheckCircle2,
  Undo2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface Comment {
  id: string
  authorName: string | null
  authorImage: string | null
  anchorFrom: number | null
  anchorTo: number | null
  body: string
  quotedText: string | null
  threadResolved: boolean
  createdAt: string
  replies: Comment[]
}

interface DocCommentSidebarProps {
  documentId: string
  className?: string
  onCommentClick?: (anchorFrom: number, anchorTo: number) => void
}

function authorInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function CommentCard({
  comment,
  onReply,
  onResolve,
  onUnresolve,
  onClick,
}: {
  comment: Comment
  onReply: (parentId: string, body: string) => Promise<void>
  onResolve: (id: string) => Promise<void>
  onUnresolve: (id: string) => Promise<void>
  onClick?: () => void
}) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleReply() {
    if (!replyBody.trim()) return
    setSubmitting(true)
    try {
      await onReply(comment.id, replyBody.trim())
      setReplyBody('')
      setShowReplyForm(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={cn(
        'group rounded-md border border-border/50 bg-card p-3 transition-colors',
        comment.threadResolved && 'opacity-60',
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <Avatar className="h-6 w-6 shrink-0 border border-border/60">
          <AvatarImage src={comment.authorImage ?? undefined} />
          <AvatarFallback className="text-[10px] font-medium">
            {authorInitials(comment.authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {comment.authorName ?? 'Unknown'}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {comment.threadResolved ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Re-open thread"
              onClick={() => onUnresolve(comment.id)}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              title="Resolve thread"
              onClick={() => onResolve(comment.id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Quoted text */}
      {comment.quotedText && (
        <button
          type="button"
          className="mt-2 block w-full cursor-pointer border-l-2 border-primary/30 pl-2.5 text-left text-xs italic text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground/70"
          onClick={onClick}
        >
          &ldquo;{comment.quotedText.slice(0, 120)}
          {comment.quotedText.length > 120 ? '…' : ''}&rdquo;
        </button>
      )}

      {/* Body */}
      <p
        className={cn(
          'mt-1.5 text-sm leading-relaxed text-foreground/90',
          comment.threadResolved && 'line-through',
        )}
      >
        {comment.body}
      </p>

      {/* Resolved badge */}
      {comment.threadResolved && (
        <Badge
          variant="secondary"
          className="mt-1.5 gap-1 text-[10px] font-normal text-emerald-600 dark:text-emerald-400"
        >
          <Check className="h-3 w-3" />
          Resolved
        </Badge>
      )}

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-2.5 space-y-2 border-l border-border/40 pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex gap-2">
              <Avatar className="mt-0.5 h-5 w-5 shrink-0 border border-border/60">
                <AvatarImage src={reply.authorImage ?? undefined} />
                <AvatarFallback className="text-[9px] font-medium">
                  {authorInitials(reply.authorName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-medium text-foreground">
                    {reply.authorName ?? 'Unknown'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(reply.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">
                  {reply.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {!comment.threadResolved && (
        <div className="mt-2">
          {showReplyForm ? (
            <div className="space-y-1.5">
              <Textarea
                placeholder="Write a reply…"
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="min-h-[60px] resize-none text-xs"
                autoFocus
              />
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setShowReplyForm(false)
                    setReplyBody('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!replyBody.trim() || submitting}
                  onClick={handleReply}
                >
                  {submitting ? 'Sending…' : 'Reply'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => setShowReplyForm(true)}
            >
              <CornerDownRight className="h-3 w-3" />
              Reply
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function DocCommentSidebar({
  documentId,
  className,
  onCommentClick,
}: DocCommentSidebarProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`)
      if (!res.ok) throw new Error('Failed to load comments')
      const data: Comment[] = await res.json()
      setComments(data)
    } catch {
      toast.error('Could not load comments')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  async function handleReply(parentId: string, body: string) {
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anchorType: 'text_range',
          body,
          parentId,
        }),
      })
      if (!res.ok) throw new Error('Failed to post reply')
      await fetchComments()
    } catch {
      toast.error('Could not post reply')
    }
  }

  async function handleResolve(commentId: string) {
    try {
      const res = await fetch(
        `/api/documents/${documentId}/comments/${commentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resolve' }),
        },
      )
      if (!res.ok) throw new Error('Failed to resolve')
      await fetchComments()
    } catch {
      toast.error('Could not resolve thread')
    }
  }

  async function handleUnresolve(commentId: string) {
    try {
      const res = await fetch(
        `/api/documents/${documentId}/comments/${commentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unresolve' }),
        },
      )
      if (!res.ok) throw new Error('Failed to unresolve')
      await fetchComments()
    } catch {
      toast.error('Could not re-open thread')
    }
  }

  const visibleComments = showResolved
    ? comments
    : comments.filter((c) => !c.threadResolved)

  const resolvedCount = comments.filter((c) => c.threadResolved).length

  return (
    <div
      className={cn(
        'flex w-80 flex-col border-l border-border/50 bg-background',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Comments</span>
          {comments.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {comments.length}
            </Badge>
          )}
        </div>
        {resolvedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={() => setShowResolved((v) => !v)}
          >
            {showResolved ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            {showResolved ? 'Hide' : 'Show'} resolved
          </Button>
        )}
      </div>

      {/* Comment list */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {loading && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Loading…
            </p>
          )}
          {!loading && visibleComments.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-30" />
              <p className="text-xs">No comments yet</p>
              <p className="text-[10px]">
                Select text in the editor to add a comment
              </p>
            </div>
          )}
          {visibleComments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onResolve={handleResolve}
              onUnresolve={handleUnresolve}
              onClick={
                comment.anchorFrom != null && comment.anchorTo != null
                  ? () =>
                      onCommentClick?.(comment.anchorFrom!, comment.anchorTo!)
                  : undefined
              }
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
