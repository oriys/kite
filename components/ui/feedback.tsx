'use client'

import * as React from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function Feedback({ className }: { className?: string }) {
  const [feedback, setFeedback] = React.useState<'positive' | 'negative' | null>(
    null
  )

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="text-sm text-muted-foreground">
        Was this page helpful?
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 w-8 p-0',
            feedback === 'positive' && 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800'
          )}
          onClick={() => setFeedback('positive')}
          disabled={feedback !== null}
        >
          <ThumbsUp className="h-4 w-4" />
          <span className="sr-only">Yes</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 w-8 p-0',
            feedback === 'negative' && 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800'
          )}
          onClick={() => setFeedback('negative')}
          disabled={feedback !== null}
        >
          <ThumbsDown className="h-4 w-4" />
          <span className="sr-only">No</span>
        </Button>
      </div>
      {feedback && (
        <div className="text-sm text-muted-foreground animate-in fade-in slide-in-from-left-2">
          Thanks for your feedback!
        </div>
      )}
    </div>
  )
}
