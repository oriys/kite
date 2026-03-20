'use client'

import * as React from 'react'
import {
  Bug,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Fingerprint,
  Laptop,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Server,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  User,
} from 'lucide-react'
import { toast } from 'sonner'

import { DocsAdminShell } from '@/components/docs/docs-admin-shell'
import { useSettingsAccess } from '@/components/settings/settings-access-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { JsonViewer } from '@/components/ui/json-viewer'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type ErrorSource =
  | 'api-route'
  | 'server-action'
  | 'server-component'
  | 'client'
  | 'middleware'
  | 'cron'
  | 'webhook'
  | 'unknown'

type ErrorLevel = 'warn' | 'error' | 'fatal'

interface ErrorLogItem {
  id: string
  occurredAt: string
  level: ErrorLevel
  source: ErrorSource
  errorName: string | null
  errorMessage: string | null
  errorStack: string | null
  errorDigest: string | null
  fingerprint: string | null
  httpMethod: string | null
  httpUrl: string | null
  httpStatus: number | null
  userId: string | null
  workspaceId: string | null
  requestId: string | null
  userAgent: string | null
  ipAddress: string | null
  context: Record<string, unknown> | null
  resolved: boolean
  resolvedAt: string | null
  resolvedBy: string | null
  resolvedNote: string | null
}

interface ErrorIssueGroup {
  fingerprint: string | null
  errorName: string | null
  errorMessage: string | null
  source: ErrorSource
  level: ErrorLevel
  occurrences: number
  lastOccurredAt: string
}

interface ErrorLogSummary {
  total: number
  unresolved: number
  resolved: number
  client: number
  server: number
  groups: ErrorIssueGroup[]
}

interface ErrorLogPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ErrorLogsResponse {
  items: ErrorLogItem[]
  pagination: ErrorLogPagination
  summary: ErrorLogSummary
}

interface FilterState {
  source: 'all' | ErrorSource
  level: 'all' | ErrorLevel
  resolved: 'all' | 'true' | 'false'
  search: string
  fingerprint: string
}

const PAGE_SIZE = 25

const DEFAULT_FILTERS: FilterState = {
  source: 'all',
  level: 'all',
  resolved: 'false',
  search: '',
  fingerprint: '',
}

const EMPTY_SUMMARY: ErrorLogSummary = {
  total: 0,
  unresolved: 0,
  resolved: 0,
  client: 0,
  server: 0,
  groups: [],
}

const SOURCE_LABELS: Record<ErrorSource, string> = {
  'api-route': 'API route',
  'server-action': 'Server action',
  'server-component': 'Server component',
  client: 'Client',
  middleware: 'Middleware',
  cron: 'Cron',
  webhook: 'Webhook',
  unknown: 'Unknown',
}

const LEVEL_LABELS: Record<ErrorLevel, string> = {
  warn: 'Warn',
  error: 'Error',
  fatal: 'Fatal',
}

function normalizeCount(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function normalizeSummary(summary: Partial<ErrorLogSummary> | undefined): ErrorLogSummary {
  if (!summary) {
    return EMPTY_SUMMARY
  }

  return {
    total: normalizeCount(summary.total),
    unresolved: normalizeCount(summary.unresolved),
    resolved: normalizeCount(summary.resolved),
    client: normalizeCount(summary.client),
    server: normalizeCount(summary.server),
    groups: Array.isArray(summary.groups)
      ? summary.groups.map((group) => ({
          ...group,
          occurrences: normalizeCount(group.occurrences),
        }))
      : [],
  }
}

function getSourceIcon(source: ErrorSource) {
  return source === 'client' ? Laptop : Server
}

function getLevelBadgeClass(level: ErrorLevel) {
  switch (level) {
    case 'warn':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'fatal':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
    default:
      return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300'
  }
}

function getStatusBadgeClass(resolved: boolean) {
  return resolved
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300'
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function formatRelativeTime(value: string | null) {
  if (!value) return 'just now'

  const diffMs = new Date(value).getTime() - Date.now()
  const absMinutes = Math.round(Math.abs(diffMs) / 60_000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (absMinutes < 60) {
    return formatter.format(Math.round(diffMs / 60_000), 'minute')
  }

  const absHours = Math.round(absMinutes / 60)
  if (absHours < 48) {
    return formatter.format(Math.round(diffMs / 3_600_000), 'hour')
  }

  return formatter.format(Math.round(diffMs / 86_400_000), 'day')
}

function truncateMiddle(value: string | null | undefined, keep = 8) {
  if (!value) return '—'
  if (value.length <= keep * 2 + 1) return value
  return `${value.slice(0, keep)}…${value.slice(-keep)}`
}

function getEventTitle(log: ErrorLogItem) {
  if (log.errorName && log.errorMessage) {
    return `${log.errorName}: ${log.errorMessage}`
  }
  if (log.errorMessage) {
    return log.errorMessage
  }
  if (log.errorName) {
    return log.errorName
  }
  return 'Unexpected error event'
}

function getContextValue(context: Record<string, unknown> | null, key: string) {
  if (!context || typeof context[key] !== 'string') {
    return null
  }
  return context[key] as string
}

function buildErrorLogQuery(page: number, filters: FilterState) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
  })

  if (filters.source !== 'all') params.set('source', filters.source)
  if (filters.level !== 'all') params.set('level', filters.level)
  if (filters.resolved !== 'all') params.set('resolved', filters.resolved)
  if (filters.search) params.set('search', filters.search)
  if (filters.fingerprint) params.set('fingerprint', filters.fingerprint)

  return params.toString()
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string
  value: number
  icon: typeof ShieldAlert
  tone: string
  hint: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-4 py-4 sm:px-5">
      <div className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border', tone)}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

function DetailPanel({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string
  eyebrow?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-background/60">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  )
}

function DetailRow({
  label,
  value,
  mono = false,
  action,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2.5 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('text-right text-sm text-foreground', mono && 'font-mono text-xs')}>
          {value}
        </span>
        {action}
      </div>
    </div>
  )
}

export function DocErrorReportsPage() {
  const { workspaceId, currentRole } = useSettingsAccess()
  const [items, setItems] = React.useState<ErrorLogItem[]>([])
  const [summary, setSummary] = React.useState<ErrorLogSummary>(EMPTY_SUMMARY)
  const [pagination, setPagination] = React.useState<ErrorLogPagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  })
  const [filters, setFilters] = React.useState<FilterState>(DEFAULT_FILTERS)
  const [searchDraft, setSearchDraft] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [pendingIds, setPendingIds] = React.useState<string[]>([])
  const [sendingTestEvent, setSendingTestEvent] = React.useState(false)
  const requestVersionRef = React.useRef(0)
  const firstLoadRef = React.useRef(true)

  const hasActiveFilters = Boolean(
    filters.source !== 'all'
      || filters.level !== 'all'
      || filters.resolved !== 'false'
      || filters.search
      || filters.fingerprint,
  )

  const fetchErrorLogs = React.useCallback(async () => {
    const requestVersion = requestVersionRef.current + 1
    requestVersionRef.current = requestVersion

    if (firstLoadRef.current) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const response = await fetch(`/api/error-logs?${buildErrorLogQuery(page, filters)}`, {
        cache: 'no-store',
      })
      const data = await response.json() as Partial<ErrorLogsResponse> & { error?: string }

      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load error reports')
      }

      if (requestVersion !== requestVersionRef.current) {
        return
      }

      setItems(Array.isArray(data.items) ? data.items : [])
      setPagination(data.pagination ?? {
        page,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 0,
      })
      setSummary(normalizeSummary(data.summary))
    } catch (error) {
      if (requestVersion === requestVersionRef.current) {
        setItems([])
        setSummary(EMPTY_SUMMARY)
        setPagination({
          page,
          limit: PAGE_SIZE,
          total: 0,
          totalPages: 0,
        })
        toast.error(error instanceof Error ? error.message : 'Failed to load error reports')
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false)
        setRefreshing(false)
        firstLoadRef.current = false
      }
    }
  }, [filters, page])

  React.useEffect(() => {
    void fetchErrorLogs()
  }, [fetchErrorLogs])

  const applySearch = React.useCallback(() => {
    setPage(1)
    setExpandedId(null)
    setFilters((current) => ({
      ...current,
      search: searchDraft.trim(),
    }))
  }, [searchDraft])

  const clearFilters = React.useCallback(() => {
    setSearchDraft('')
    setExpandedId(null)
    setPage(1)
    setFilters(DEFAULT_FILTERS)
  }, [])

  const toggleResolved = React.useCallback(async (log: ErrorLogItem) => {
    setPendingIds((current) => [...current, log.id])

    try {
      const response = await fetch('/api/error-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: [log.id],
          resolved: !log.resolved,
        }),
      })
      const data = await response.json() as { error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update error state')
      }

      toast.success(log.resolved ? 'Issue reopened' : 'Issue marked as resolved')
      setExpandedId((current) => (current === log.id && !log.resolved ? null : current))
      await fetchErrorLogs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update error state')
    } finally {
      setPendingIds((current) => current.filter((id) => id !== log.id))
    }
  }, [fetchErrorLogs])

  const sendTestEvent = React.useCallback(async () => {
    setSendingTestEvent(true)

    try {
      const message = `Manual test event from Error Reports (${new Date().toISOString()})`
      const syntheticError = new Error(message)
      const response = await fetch('/api/error-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorName: 'ManualTestError',
          errorMessage: message,
          errorStack: syntheticError.stack,
          url: window.location.href,
          context: {
            manualTest: true,
            triggeredFrom: 'docs-settings-error-reports',
            pathname: window.location.pathname,
          },
        }),
      })
      const data = await response.json() as { error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to send test event')
      }

      setExpandedId(null)
      setPage(1)
      setSearchDraft('Manual test event')
      setFilters({
        source: 'client',
        level: 'all',
        resolved: 'false',
        search: 'Manual test event',
        fingerprint: '',
      })
      toast.success('Test event sent. The newest client event should appear at the top.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send test event')
    } finally {
      setSendingTestEvent(false)
    }
  }, [])

  const metricCards = [
    {
      label: 'Open issues',
      value: summary.unresolved,
      icon: ShieldAlert,
      tone: 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-300',
      hint: 'Active alerts that still need review.',
    },
    {
      label: 'Resolved',
      value: summary.resolved,
      icon: ShieldCheck,
      tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
      hint: 'Events that have already been triaged.',
    },
    {
      label: 'Client events',
      value: summary.client,
      icon: Laptop,
      tone: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300',
      hint: 'Browser-side crashes, boundary hits, and rejected promises.',
    },
    {
      label: 'Server events',
      value: summary.server,
      icon: Server,
      tone: 'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-300',
      hint: 'API, server component, and middleware failures.',
    },
  ] as const

  return (
    <DocsAdminShell
      kicker="Error Monitoring"
      title="Error Reports"
      description="Track client and server failures inside the current workspace, inspect stack traces and structured context, and verify the collection pipeline with a manual test event."
      actions={(
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void fetchErrorLogs()}
            disabled={refreshing || loading}
          >
            <RefreshCw className={cn('size-4', (refreshing || loading) && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={() => void sendTestEvent()}
            disabled={sendingTestEvent}
          >
            {sendingTestEvent ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send test event
          </Button>
        </>
      )}
      meta={(
        <>
          <span className="inline-flex items-center gap-1">
            <ShieldAlert className="size-3.5" />
            Admin only
          </span>
          <span className="inline-flex items-center gap-1">
            <Bug className="size-3.5" />
            {summary.total} scoped events
          </span>
          <span className="inline-flex items-center gap-1">
            <User className="size-3.5" />
            {currentRole} access
          </span>
          <span className="inline-flex items-center gap-1 font-mono">
            ws {truncateMiddle(workspaceId, 6)}
          </span>
        </>
      )}
      notice={(
        <p className="text-sm leading-6 text-muted-foreground">
          Only events attributed to the current workspace appear here. Use{' '}
          <span className="font-medium text-foreground">Send test event</span>{' '}
          to confirm that client-side capture, workspace scoping, and ingestion are wired correctly.
        </p>
      )}
    >
      <section className="editorial-surface overflow-hidden editorial-reveal">
        <div className="grid gap-px bg-border/60 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => (
            <div key={card.label} className="bg-background/80">
              <MetricCard {...card} />
            </div>
          ))}
        </div>

        <div className="border-t border-border/70 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Top recurring issues
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                Fingerprints with the most unresolved activity
              </h2>
            </div>
            {filters.fingerprint ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start sm:justify-center"
                onClick={() => {
                  setPage(1)
                  setFilters((current) => ({ ...current, fingerprint: '' }))
                }}
              >
                Clear fingerprint focus
              </Button>
            ) : null}
          </div>

          {summary.groups.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-background/50 px-4 py-5 text-sm text-muted-foreground">
              No grouped issues yet for this workspace.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {summary.groups.map((group) => {
                const Icon = getSourceIcon(group.source)
                const groupFingerprint = group.fingerprint ?? ''
                const active = Boolean(groupFingerprint) && filters.fingerprint === groupFingerprint

                return (
                  <button
                    key={`${groupFingerprint || 'ungrouped'}:${group.errorName || 'error'}:${group.lastOccurredAt}`}
                    type="button"
                    className={cn(
                      'rounded-xl border px-4 py-4 text-left transition-colors',
                      active
                        ? 'border-blue-500/30 bg-blue-500/[0.08]'
                        : 'border-border/70 bg-background/55 hover:bg-muted/50',
                    )}
                    onClick={() => {
                      if (!groupFingerprint) return
                      setExpandedId(null)
                      setPage(1)
                      setFilters((current) => ({
                        ...current,
                        fingerprint: groupFingerprint,
                      }))
                    }}
                    disabled={!groupFingerprint}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={getLevelBadgeClass(group.level)}>
                            {LEVEL_LABELS[group.level]}
                          </Badge>
                          <Badge variant="outline" className="font-normal tracking-[0.12em]">
                            <Icon className="size-3" />
                            {SOURCE_LABELS[group.source]}
                          </Badge>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm font-semibold text-foreground">
                          {group.errorMessage || group.errorName || 'Unexpected issue'}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Bug className="size-3.5" />
                            {group.occurrences} hits
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="size-3.5" />
                            {formatRelativeTime(group.lastOccurredAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge
                          variant="outline"
                          className="max-w-[15rem] font-mono normal-case tracking-normal"
                        >
                          {truncateMiddle(groupFingerprint || 'ungrouped', 6)}
                        </Badge>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="editorial-surface overflow-hidden editorial-reveal">
        <div className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      applySearch()
                    }
                  }}
                  placeholder="Search by message, URL, fingerprint, or request ID"
                  className="pl-9"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-auto">
                <Select
                  value={filters.source}
                  onValueChange={(value) => {
                    setExpandedId(null)
                    setPage(1)
                    setFilters((current) => ({
                      ...current,
                      source: value as FilterState['source'],
                    }))
                  }}
                >
                  <SelectTrigger className="w-full lg:w-40">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.level}
                  onValueChange={(value) => {
                    setExpandedId(null)
                    setPage(1)
                    setFilters((current) => ({
                      ...current,
                      level: value as FilterState['level'],
                    }))
                  }}
                >
                  <SelectTrigger className="w-full lg:w-32">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All levels</SelectItem>
                    {Object.entries(LEVEL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.resolved}
                  onValueChange={(value) => {
                    setExpandedId(null)
                    setPage(1)
                    setFilters((current) => ({
                      ...current,
                      resolved: value as FilterState['resolved'],
                    }))
                  }}
                >
                  <SelectTrigger className="w-full lg:w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Open only</SelectItem>
                    <SelectItem value="true">Resolved only</SelectItem>
                    <SelectItem value="all">All statuses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={applySearch}>
                <Search className="size-3.5" />
                Apply filters
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                disabled={!hasActiveFilters && !searchDraft}
              >
                Clear
              </Button>
              {filters.fingerprint ? (
                <Badge variant="outline" className="font-mono normal-case tracking-normal">
                  <Fingerprint className="size-3" />
                  {filters.fingerprint}
                </Badge>
              ) : null}
              {filters.search ? (
                <Badge variant="outline" className="normal-case tracking-normal">
                  search: {filters.search}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading workspace error reports…
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-16 text-center sm:px-5">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-muted/40">
                <TriangleAlert className="size-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  No events match this view
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Try clearing the filters or send a test event to validate the pipeline from this workspace.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
                <Button type="button" size="sm" onClick={() => void sendTestEvent()} disabled={sendingTestEvent}>
                  {sendingTestEvent ? 'Sending…' : 'Send test event'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/70">
              {items.map((log) => {
                const Icon = getSourceIcon(log.source)
                const componentStack = getContextValue(log.context, 'componentStack')
                const isPending = pendingIds.includes(log.id)
                const isExpanded = expandedId === log.id

                return (
                  <Collapsible
                    key={log.id}
                    open={isExpanded}
                    onOpenChange={(open) => setExpandedId(open ? log.id : null)}
                  >
                    <article className={cn('px-4 py-4 transition-colors sm:px-5', log.resolved && 'bg-muted/20')}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <CollapsibleTrigger asChild>
                          <button type="button" className="group flex min-w-0 flex-1 items-start gap-3 text-left">
                            <div
                              className={cn(
                                'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border',
                                log.resolved
                                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                  : 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-300',
                              )}
                            >
                              <Icon className="size-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={getLevelBadgeClass(log.level)}>
                                  {LEVEL_LABELS[log.level]}
                                </Badge>
                                <Badge variant="outline" className="font-normal tracking-[0.12em]">
                                  {SOURCE_LABELS[log.source]}
                                </Badge>
                                <Badge variant="outline" className={getStatusBadgeClass(log.resolved)}>
                                  {log.resolved ? 'Resolved' : 'Open'}
                                </Badge>
                              </div>

                              <h2 className="mt-3 line-clamp-2 text-sm font-semibold text-foreground transition-colors group-hover:text-foreground/85">
                                {getEventTitle(log)}
                              </h2>

                              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Clock3 className="size-3.5" />
                                  {formatRelativeTime(log.occurredAt)}
                                </span>
                                {log.httpUrl ? (
                                  <span className="inline-flex min-w-0 items-center gap-1">
                                    <ExternalLink className="size-3.5 shrink-0" />
                                    <span className="max-w-[26rem] truncate">{log.httpUrl}</span>
                                  </span>
                                ) : null}
                                {log.fingerprint ? (
                                  <span className="inline-flex min-w-0 items-center gap-1 font-mono">
                                    <Fingerprint className="size-3.5 shrink-0" />
                                    {truncateMiddle(log.fingerprint, 6)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        </CollapsibleTrigger>

                        <div className="flex shrink-0 items-center gap-2">
                          {log.fingerprint ? (
                            <Badge
                              variant="outline"
                              className="hidden max-w-[14rem] font-mono normal-case tracking-normal xl:inline-flex"
                            >
                              {truncateMiddle(log.fingerprint, 6)}
                            </Badge>
                          ) : null}
                          <Button
                            type="button"
                            variant={log.resolved ? 'outline' : 'secondary'}
                            size="sm"
                            className="gap-2"
                            disabled={isPending}
                            onClick={() => void toggleResolved(log)}
                          >
                            {isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : log.resolved ? (
                              <ShieldAlert className="size-4" />
                            ) : (
                              <CheckCircle2 className="size-4" />
                            )}
                            {log.resolved ? 'Reopen' : 'Resolve'}
                          </Button>
                        </div>
                      </div>

                      <CollapsibleContent className="overflow-hidden">
                        <div className="mt-4 grid gap-4 border-t border-border/70 pt-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,1fr)]">
                          <div className="space-y-4">
                            {log.errorStack ? (
                              <DetailPanel
                                eyebrow="Runtime"
                                title="Stack trace"
                                action={<CopyButton value={log.errorStack} aria-label="Copy stack trace" />}
                              >
                                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 font-mono text-xs leading-6 text-foreground">
                                  {log.errorStack}
                                </pre>
                              </DetailPanel>
                            ) : null}

                            {componentStack ? (
                              <DetailPanel
                                eyebrow="React"
                                title="Component stack"
                                action={<CopyButton value={componentStack} aria-label="Copy component stack" />}
                              >
                                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 font-mono text-xs leading-6 text-foreground">
                                  {componentStack}
                                </pre>
                              </DetailPanel>
                            ) : null}

                            {log.context ? (
                              <DetailPanel eyebrow="Context" title="Structured payload">
                                <JsonViewer data={log.context} initialExpanded={false} maxHeight={320} />
                              </DetailPanel>
                            ) : (
                              <DetailPanel eyebrow="Context" title="Structured payload">
                                <p className="text-sm leading-6 text-muted-foreground">
                                  This event did not include extra structured context.
                                </p>
                              </DetailPanel>
                            )}
                          </div>

                          <div className="space-y-4">
                            <DetailPanel eyebrow="Metadata" title="Event fields">
                              <DetailRow
                                label="Occurred"
                                value={`${formatDateTime(log.occurredAt)} (${formatRelativeTime(log.occurredAt)})`}
                              />
                              <DetailRow
                                label="Fingerprint"
                                value={log.fingerprint ?? '—'}
                                mono
                                action={log.fingerprint ? <CopyButton value={log.fingerprint} /> : undefined}
                              />
                              <DetailRow label="Digest" value={log.errorDigest ?? '—'} mono />
                              <DetailRow label="Status" value={log.resolved ? 'Resolved' : 'Open'} />
                              <DetailRow label="Source" value={SOURCE_LABELS[log.source]} />
                              <DetailRow label="Level" value={LEVEL_LABELS[log.level]} />
                              <DetailRow
                                label="User"
                                value={log.userId ?? '—'}
                                mono
                                action={log.userId ? <CopyButton value={log.userId} /> : undefined}
                              />
                              <DetailRow
                                label="Workspace"
                                value={log.workspaceId ?? '—'}
                                mono
                                action={log.workspaceId ? <CopyButton value={log.workspaceId} /> : undefined}
                              />
                              <DetailRow
                                label="Request ID"
                                value={log.requestId ?? '—'}
                                mono
                                action={log.requestId ? <CopyButton value={log.requestId} /> : undefined}
                              />
                              <DetailRow label="IP" value={log.ipAddress ?? '—'} mono />
                              <DetailRow
                                label="User agent"
                                value={log.userAgent ? truncateMiddle(log.userAgent, 18) : '—'}
                              />
                              <DetailRow
                                label="HTTP"
                                value={
                                  log.httpMethod || log.httpUrl || log.httpStatus
                                    ? [log.httpMethod, log.httpStatus ? String(log.httpStatus) : null, log.httpUrl]
                                      .filter(Boolean)
                                      .join(' · ')
                                    : '—'
                                }
                              />
                            </DetailPanel>

                            {log.httpUrl ? (
                              <DetailPanel
                                eyebrow="Route"
                                title="Affected URL"
                                action={<CopyButton value={log.httpUrl} aria-label="Copy URL" />}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <a
                                    href={log.httpUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="min-w-0 break-all text-sm leading-6 text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-blue-700 dark:hover:text-blue-300"
                                  >
                                    {log.httpUrl}
                                  </a>
                                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                                </div>
                              </DetailPanel>
                            ) : null}

                            {log.resolved && (log.resolvedAt || log.resolvedBy || log.resolvedNote) ? (
                              <DetailPanel eyebrow="Review" title="Resolution history">
                                <DetailRow label="Resolved at" value={formatDateTime(log.resolvedAt)} />
                                <DetailRow label="Resolved by" value={log.resolvedBy ?? '—'} mono />
                                <DetailRow label="Note" value={log.resolvedNote ?? '—'} />
                              </DetailPanel>
                            ) : null}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </article>
                  </Collapsible>
                )
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-4 text-sm text-muted-foreground sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Showing {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </span>
                {refreshing ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Updating…
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={page <= 1}
                  onClick={() => {
                    setExpandedId(null)
                    setPage((current) => current - 1)
                  }}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Page {pagination.page} / {Math.max(pagination.totalPages, 1)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={pagination.totalPages <= 1 || page >= pagination.totalPages}
                  onClick={() => {
                    setExpandedId(null)
                    setPage((current) => current + 1)
                  }}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </DocsAdminShell>
  )
}
