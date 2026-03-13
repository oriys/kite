'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { parseAiDiagramResult } from '@/lib/ai-diagram'
import { cn } from '@/lib/utils'
import { MarkdownPreview } from '@/components/docs/markdown-preview'
import { Badge } from '@/components/ui/badge'

interface DocAiDiagramPreviewProps {
  resultText: string
  pending?: boolean
  className?: string
}

export function DocAiDiagramPreview({
  resultText,
  pending,
  className,
}: DocAiDiagramPreviewProps) {
  const parsed = React.useMemo(
    () => parseAiDiagramResult(resultText),
    [resultText],
  )
  const iframeRef = React.useRef<HTMLIFrameElement>(null)
  const writtenHtmlRef = React.useRef('')
  const documentOpenRef = React.useRef(false)

  React.useEffect(() => {
    const frame = iframeRef.current
    const document = frame?.contentDocument
    const nextHtml = parsed.chartHtml

    if (!document) {
      return
    }

    if (!nextHtml) {
      if (writtenHtmlRef.current) {
        document.open()
        document.write('')
        document.close()
      }

      writtenHtmlRef.current = ''
      documentOpenRef.current = false
      return
    }

    const shouldRewrite = !nextHtml.startsWith(writtenHtmlRef.current)

    if (shouldRewrite || !documentOpenRef.current) {
      document.open()
      document.write(nextHtml)
      writtenHtmlRef.current = nextHtml
      documentOpenRef.current = true

      if (!pending) {
        document.close()
        documentOpenRef.current = false
      }
      return
    }

    const delta = nextHtml.slice(writtenHtmlRef.current.length)
    if (delta) {
      document.write(delta)
      writtenHtmlRef.current = nextHtml
    }

    if (!pending && documentOpenRef.current) {
      document.close()
      documentOpenRef.current = false
    }
  }, [parsed.chartHtml, pending])

  React.useEffect(
    () => () => {
      const document = iframeRef.current?.contentDocument
      if (document && documentOpenRef.current) {
        document.close()
      }
    },
    [],
  )

  const analysisContent = parsed.hasStructuredOutput
    ? parsed.analysisMarkdown
    : resultText.trim()
  const statusLabel = pending
    ? 'Streaming'
    : parsed.chartComplete
      ? 'Complete'
      : parsed.chartStarted
        ? 'Partial'
        : 'Waiting'

  return (
    <div className={cn('space-y-5', className)}>
      {analysisContent ? (
        <section className="space-y-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Analysis
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Background, explanation, and reasoning stay outside the diagram.
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background px-4 py-4">
            <MarkdownPreview
              content={analysisContent}
              className="prose-editorial max-w-none text-[15px] leading-7"
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Diagram
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Embedded iframe preview with chart-only content.
            </p>
          </div>
          <Badge variant={pending ? 'secondary' : 'outline'}>{statusLabel}</Badge>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
          <div className="border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            Embedded preview
          </div>

          {parsed.chartStarted ? (
            <iframe
              ref={iframeRef}
              title="AI diagram preview"
              sandbox="allow-same-origin"
              referrerPolicy="no-referrer"
              className="block h-[28rem] w-full border-0 bg-transparent"
            />
          ) : (
            <div className="flex h-[20rem] flex-col items-center justify-center gap-3 bg-muted/[0.06] px-6 text-center">
              {pending ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
              <div className="max-w-sm space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {pending
                    ? 'Preparing the streamed diagram...'
                    : 'Diagram preview unavailable'}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {pending
                    ? 'Analysis can arrive first. The iframe will start rendering as soon as the HTML shell streams in.'
                    : 'The model did not return a diagram block. Retry to request another preview.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
