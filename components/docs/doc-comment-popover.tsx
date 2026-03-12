'use client'

import { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquarePlus } from 'lucide-react'
import { toast } from 'sonner'

interface DocCommentPopoverProps {
  documentId: string
  anchorFrom: number
  anchorTo: number
  quotedText: string
  onCommentCreated: () => void
  children: React.ReactNode
}

export function DocCommentPopover({
  documentId,
  anchorFrom,
  anchorTo,
  quotedText,
  onCommentCreated,
  children,
}: DocCommentPopoverProps) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!body.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anchorType: 'text_range',
          anchorFrom,
          anchorTo,
          quotedText,
          body: body.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? 'Failed to create comment')
      }
      setBody('')
      setOpen(false)
      onCommentCreated()
      toast.success('Comment added')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not add comment',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const preview =
    quotedText.length > 100 ? quotedText.slice(0, 100) + '…' : quotedText

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-3"
        side="right"
        align="start"
        sideOffset={8}
      >
        <div className="space-y-3">
          {/* Quoted text preview */}
          <div className="border-l-2 border-primary/30 pl-2.5">
            <p className="text-xs italic text-muted-foreground">
              &ldquo;{preview}&rdquo;
            </p>
          </div>

          {/* Comment body */}
          <Textarea
            placeholder="Add a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[80px] resize-none text-sm"
            autoFocus
          />

          {/* Actions */}
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setOpen(false)
                setBody('')
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={!body.trim() || submitting}
              onClick={handleSubmit}
            >
              <MessageSquarePlus className="h-3 w-3" />
              {submitting ? 'Posting…' : 'Comment'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
