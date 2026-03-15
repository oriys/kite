'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  XCircle,
  Info,
  Lightbulb,
  Play,
  RefreshCw,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'

interface LintIssue {
  code: string | number
  message: string
  severity: 'error' | 'warning' | 'info' | 'hint'
  path: string[]
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
}

interface LintResultData {
  id?: string
  results: LintIssue[]
  errorCount: number
  warningCount: number
  infoCount: number
  hintCount: number
  ranAt?: string
}

interface LintResultsPanelProps {
  openapiSourceId: string
}

type SeverityFilter = 'all' | 'error' | 'warning' | 'info' | 'hint'

const severityConfig = {
  error: {
    icon: XCircle,
    label: 'Error',
    badgeClass: 'border-[var(--tone-error-border)] bg-[var(--tone-error-bg)] text-[var(--tone-error-text)]',
    dotClass: 'bg-[var(--tone-error-text)]',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    badgeClass: 'border-[var(--tone-caution-border)] bg-[var(--tone-caution-bg)] text-[var(--tone-caution-text)]',
    dotClass: 'bg-[var(--tone-caution-text)]',
  },
  info: {
    icon: Info,
    label: 'Info',
    badgeClass: 'border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]',
    dotClass: 'bg-[var(--tone-info-text)]',
  },
  hint: {
    icon: Lightbulb,
    label: 'Hint',
    badgeClass: 'border-border bg-muted text-muted-foreground',
    dotClass: 'bg-muted-foreground',
  },
} as const

export function LintResultsPanel({ openapiSourceId }: LintResultsPanelProps) {
  const [data, setData] = useState<LintResultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [filter, setFilter] = useState<SeverityFilter>('all')

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/openapi/${openapiSourceId}/lint`)
      if (!res.ok) throw new Error('Failed to fetch lint results')
      const json = await res.json()
      setData(json)
    } catch {
      // No prior results is fine
    } finally {
      setLoading(false)
    }
  }, [openapiSourceId])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  const runLint = useCallback(async () => {
    setRunning(true)
    try {
      const res = await fetch(`/api/openapi/${openapiSourceId}/lint`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Lint failed')
      const json = await res.json()
      setData(json)
      toast.success('Lint completed')
    } catch {
      toast.error('Failed to run lint')
    } finally {
      setRunning(false)
    }
  }, [openapiSourceId])

  const issues = data?.results ?? []
  const filtered =
    filter === 'all' ? issues : issues.filter((i) => i.severity === filter)
  const totalIssues = issues.length

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="size-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            onClick={runLint}
            disabled={running}
          >
            {running ? (
              <RefreshCw className="mr-1.5 size-3 animate-spin" />
            ) : (
              <Play className="mr-1.5 size-3" />
            )}
            {data?.ranAt ? 'Re-run Lint' : 'Run Lint'}
          </Button>
          {data?.ranAt && (
            <span className="text-[11px] text-muted-foreground">
              Last run:{' '}
              {new Date(data.ranAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        {totalIssues > 0 && (
          <div className="flex items-center gap-1.5">
            <Filter className="size-3 text-muted-foreground" />
            {(
              ['all', 'error', 'warning', 'info', 'hint'] as SeverityFilter[]
            ).map((f) => {
              const count =
                f === 'all'
                  ? totalIssues
                  : issues.filter((i) => i.severity === f).length
              if (f !== 'all' && count === 0) return null
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    filter === f
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f === 'all' ? 'All' : severityConfig[f].label}{' '}
                  <span className="opacity-60">{count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Summary counters */}
      {data && totalIssues > 0 && (
        <div className="flex gap-2">
          {(
            [
              { key: 'error' as const, count: data.errorCount },
              { key: 'warning' as const, count: data.warningCount },
              { key: 'info' as const, count: data.infoCount },
              { key: 'hint' as const, count: data.hintCount },
            ] as const
          )
            .filter((s) => s.count > 0)
            .map((s) => {
              const config = severityConfig[s.key]
              const Icon = config.icon
              return (
                <Badge
                  key={s.key}
                  variant="outline"
                  className={`gap-1 text-[11px] ${config.badgeClass}`}
                >
                  <Icon className="size-3" />
                  {s.count} {config.label.toLowerCase()}
                  {s.count !== 1 ? 's' : ''}
                </Badge>
              )
            })}
        </div>
      )}

      {/* Empty / clean state */}
      {data && totalIssues === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-[var(--tone-success-bg)]">
              <svg
                className="size-5 text-[var(--tone-success-text)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">
              No issues found
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your OpenAPI spec passed all lint rules.
            </p>
          </CardContent>
        </Card>
      )}

      {/* No results yet */}
      {!data?.ranAt && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Play className="mb-2 size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">
              No lint results yet
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Run lint to validate your OpenAPI spec against standard rules.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Issues list */}
      {filtered.length > 0 && (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Issues ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="divide-y divide-border">
              {filtered.map((issue, idx) => {
                const config = severityConfig[issue.severity]
                const Icon = config.icon
                return (
                  <div
                    key={`${issue.code}-${idx}`}
                    className="flex gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <Icon
                      className={`mt-0.5 size-4 shrink-0`}
                      style={{
                        color:
                          issue.severity === 'hint'
                            ? undefined
                            : `var(--tone-${issue.severity === 'warning' ? 'caution' : issue.severity}-text)`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug text-foreground">
                        {issue.message}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {issue.code}
                        </code>
                        {issue.path.length > 0 && (
                          <span className="flex items-center gap-0.5 font-mono text-[11px] text-muted-foreground">
                            {issue.path.map((segment, i) => (
                              <span key={i} className="flex items-center">
                                {i > 0 && (
                                  <ChevronRight className="size-2.5 opacity-40" />
                                )}
                                <span>{segment}</span>
                              </span>
                            ))}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/60">
                          Ln {issue.range.start.line + 1}
                          {issue.range.start.character > 0 &&
                            `:${issue.range.start.character + 1}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
