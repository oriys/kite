'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import type { AgentInteraction } from '@/lib/agent/shared'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface InteractionWidgetProps {
  interaction: AgentInteraction
  onRespond: (body: Record<string, unknown>) => Promise<void> | void
}

interface InlineInteractionShellProps {
  eyebrow: string
  message: string
  submitting: boolean
  error: string | null
  children: React.ReactNode
  footer?: React.ReactNode
}

function InlineInteractionShell({
  eyebrow,
  message,
  submitting,
  error,
  children,
  footer,
}: InlineInteractionShellProps) {
  return (
    <div className="space-y-3 rounded-[1.35rem] border border-border/70 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--background)_94%,var(--primary)_6%),color-mix(in_oklch,var(--background)_98%,var(--muted)_2%))] px-3.5 py-3.5 shadow-[0_18px_42px_-32px_rgba(15,23,42,0.28)]">
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <p className="max-w-prose text-sm leading-6 text-foreground whitespace-pre-wrap">
          {message}
        </p>
      </div>

      {submitting ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <Loader2 className="size-3 animate-spin" />
          Sending your reply…
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="space-y-2.5">{children}</div>

      {footer ? <div className="text-[11px] leading-5 text-muted-foreground">{footer}</div> : null}
    </div>
  )
}

export function DocAgentInteractionWidget({
  interaction,
  onRespond,
}: InteractionWidgetProps) {
  const [inputValue, setInputValue] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setInputValue('')
    setSubmitting(false)
    setError(null)
  }, [interaction.id])

  const handleRespond = React.useCallback(
    async (body: Record<string, unknown>) => {
      setSubmitting(true)
      setError(null)

      try {
        await onRespond(body)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send response')
      } finally {
        setSubmitting(false)
      }
    },
    [onRespond],
  )

  if (interaction.type === 'confirm') {
    return (
      <InlineInteractionShell
        eyebrow="Quick decision"
        message={interaction.message}
        submitting={submitting}
        error={error}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            className="min-h-11 flex-1 text-sm"
            disabled={submitting}
            onClick={() => {
              void handleRespond({ accepted: true })
            }}
          >
            Approve
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 text-sm"
            disabled={submitting}
            onClick={() => {
              void handleRespond({ accepted: false })
            }}
          >
            Not now
          </Button>
        </div>
      </InlineInteractionShell>
    )
  }

  if (interaction.type === 'select') {
    return (
      <InlineInteractionShell
        eyebrow="Choose one"
        message={interaction.message}
        submitting={submitting}
        error={error}
      >
        <div className="flex flex-col gap-1.5">
          {interaction.options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={submitting}
              onClick={() => {
                void handleRespond({ selected: option })
              }}
              className="min-h-11 rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-left text-sm transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:cursor-default disabled:opacity-70"
            >
              {option}
            </button>
          ))}
        </div>
      </InlineInteractionShell>
    )
  }

  if (interaction.type === 'page') {
    return (
      <InlineInteractionShell
        eyebrow="Reply"
        message={interaction.message}
        submitting={submitting}
        error={error}
        footer="Structured forms are disabled here for reliability. Reply in plain text and the agent will continue from your notes."
      >
        <Textarea
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Type your response..."
          disabled={submitting}
          className="min-h-[104px] resize-none text-sm"
          rows={4}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter'
              && !event.shiftKey
              && !submitting
              && inputValue.trim()
            ) {
              event.preventDefault()
              void handleRespond({
                action: 'submit',
                values: {
                  response: inputValue.trim(),
                },
              })
            }
          }}
        />
        <Button
          type="button"
          className="min-h-11 w-full text-sm sm:w-auto"
          disabled={submitting || !inputValue.trim()}
          onClick={() => {
            void handleRespond({
              action: 'submit',
              values: {
                response: inputValue.trim(),
              },
            })
          }}
        >
          Send reply
        </Button>
      </InlineInteractionShell>
    )
  }

  return (
    <InlineInteractionShell
      eyebrow="Quick reply"
      message={interaction.message}
      submitting={submitting}
      error={error}
      footer="Press Enter to send. Use Shift+Enter for a new line."
    >
      <Textarea
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        placeholder={interaction.placeholder ?? 'Type your response...'}
        disabled={submitting}
        className="min-h-[88px] resize-none text-sm"
        rows={3}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter'
            && !event.shiftKey
            && !submitting
            && inputValue.trim()
          ) {
            event.preventDefault()
            void handleRespond({ text: inputValue.trim() })
          }
        }}
      />
      <Button
        type="button"
        className="min-h-11 w-full text-sm sm:w-auto"
        disabled={submitting || !inputValue.trim()}
        onClick={() => {
          void handleRespond({ text: inputValue.trim() })
        }}
      >
        Send reply
      </Button>
    </InlineInteractionShell>
  )
}
