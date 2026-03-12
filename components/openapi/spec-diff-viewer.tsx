'use client'

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface EndpointDiff {
  added: { path: string; method: string; summary?: string }[]
  removed: { path: string; method: string; summary?: string }[]
  changed: {
    path: string
    method: string
    changes: { field: string; from: unknown; to: unknown }[]
  }[]
}

interface SpecDiffViewerProps {
  diff: EndpointDiff
  className?: string
}

export function SpecDiffViewer({ diff, className }: SpecDiffViewerProps) {
  const totalChanges = diff.added.length + diff.removed.length + diff.changed.length

  if (totalChanges === 0) {
    return (
      <div className={cn('py-12 text-center text-sm text-muted-foreground', className)}>
        No differences detected.
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary */}
      <div className="flex items-center gap-3 text-sm">
        {diff.added.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {diff.added.length} added
          </span>
        )}
        {diff.removed.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
            {diff.removed.length} removed
          </span>
        )}
        {diff.changed.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            {diff.changed.length} changed
          </span>
        )}
      </div>

      {/* Added endpoints */}
      {diff.added.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Added Endpoints
          </h3>
          <div className="space-y-1">
            {diff.added.map((ep) => (
              <div
                key={`${ep.method} ${ep.path}`}
                className="flex items-center gap-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
              >
                <MethodBadge method={ep.method} />
                <code className="text-sm">{ep.path}</code>
                {ep.summary && (
                  <span className="text-sm text-muted-foreground">
                    {ep.summary}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className="ml-auto border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                >
                  New
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Removed endpoints */}
      {diff.removed.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Removed Endpoints
          </h3>
          <div className="space-y-1">
            {diff.removed.map((ep) => (
              <div
                key={`${ep.method} ${ep.path}`}
                className="flex items-center gap-3 rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2"
              >
                <MethodBadge method={ep.method} />
                <code className="text-sm line-through opacity-70">
                  {ep.path}
                </code>
                {ep.summary && (
                  <span className="text-sm text-muted-foreground line-through opacity-70">
                    {ep.summary}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className="ml-auto border-rose-500/30 text-rose-600 dark:text-rose-400"
                >
                  Removed
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Changed endpoints */}
      {diff.changed.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Changed Endpoints
          </h3>
          <Accordion type="multiple" className="space-y-1">
            {diff.changed.map((ep) => (
              <AccordionItem
                key={`${ep.method} ${ep.path}`}
                value={`${ep.method} ${ep.path}`}
                className="rounded-md border border-amber-500/20 bg-amber-500/5 px-0"
              >
                <AccordionTrigger className="gap-3 px-3 py-2.5 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <MethodBadge method={ep.method} />
                    <code className="text-sm">{ep.path}</code>
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 text-amber-600 dark:text-amber-400"
                    >
                      {ep.changes.length} change{ep.changes.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-2">
                    {ep.changes.map((change, i) => (
                      <div
                        key={i}
                        className="rounded border bg-card p-2.5 text-xs"
                      >
                        <span className="font-medium text-foreground">
                          {change.field}
                        </span>
                        <div className="mt-1.5 grid gap-1">
                          <div className="flex items-start gap-2">
                            <span className="mt-px inline-block h-4 w-4 shrink-0 rounded bg-rose-500/15 text-center text-[10px] font-bold leading-4 text-rose-600 dark:text-rose-400">
                              −
                            </span>
                            <pre className="whitespace-pre-wrap break-all text-muted-foreground">
                              {formatValue(change.from)}
                            </pre>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="mt-px inline-block h-4 w-4 shrink-0 rounded bg-emerald-500/15 text-center text-[10px] font-bold leading-4 text-emerald-600 dark:text-emerald-400">
                              +
                            </span>
                            <pre className="whitespace-pre-wrap break-all text-foreground">
                              {formatValue(change.to)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}
    </div>
  )
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
  POST: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25',
  PUT: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25',
  DELETE: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25',
  PATCH: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/25',
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[4rem] items-center justify-center rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide',
        METHOD_COLORS[method] ?? 'bg-muted text-muted-foreground border-border',
      )}
    >
      {method}
    </span>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(none)'
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  return JSON.stringify(value, null, 2)
}
