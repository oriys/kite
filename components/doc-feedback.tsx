'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface DocFeedbackProps {
  documentId: string
  className?: string
}

type Phase = 'vote' | 'comment' | 'done'

function getStorageKey(documentId: string) {
  return `doc-feedback-${documentId}`
}

function hasVoted(documentId: string): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(getStorageKey(documentId)) === '1'
}

function markVoted(documentId: string) {
  try {
    localStorage.setItem(getStorageKey(documentId), '1')
  } catch {
    // localStorage may be unavailable
  }
}

export function DocFeedback({ documentId, className }: DocFeedbackProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    hasVoted(documentId) ? 'done' : 'vote',
  )
  const [helpful, setHelpful] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = useCallback(
    async (isHelpful: boolean, userComment?: string) => {
      setSubmitting(true)
      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId,
            isHelpful,
            comment: userComment || undefined,
          }),
        })

        if (!res.ok) {
          toast.error('Failed to submit feedback')
          return
        }

        markVoted(documentId)
        setPhase('done')
        toast.success('Thank you for your feedback!')
      } catch {
        toast.error('Failed to submit feedback')
      } finally {
        setSubmitting(false)
      }
    },
    [documentId],
  )

  if (phase === 'done') {
    return (
      <div className={cn('border-t py-6 text-center', className)}>
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="size-4 text-success" />
          Thank you for your feedback!
        </div>
      </div>
    )
  }

  if (phase === 'comment') {
    return (
      <div className={cn('border-t py-6', className)}>
        <p className="mb-3 text-sm text-muted-foreground">
          Any additional feedback? <span className="text-xs">(optional)</span>
        </p>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us more…"
          maxLength={1000}
          rows={3}
          className="mb-3"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => submit(helpful!, comment || undefined)}
            disabled={submitting}
          >
            Submit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => submit(helpful!)}
            disabled={submitting}
          >
            Skip
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('border-t py-6 text-center', className)}>
      <p className="mb-3 text-sm text-muted-foreground">Was this page helpful?</p>
      <div className="inline-flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setHelpful(true)
            setPhase('comment')
          }}
        >
          <ThumbsUp className="size-4" />
          Yes
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setHelpful(false)
            setPhase('comment')
          }}
        >
          <ThumbsDown className="size-4" />
          No
        </Button>
      </div>
    </div>
  )
}
