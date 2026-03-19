'use client'

import { Download, Loader2, PencilLine, RefreshCw, Trash2, X } from 'lucide-react'

import type { KnowledgeSourceItem } from '@/hooks/use-knowledge-sources'
import { getProcessingProgress } from '@/hooks/use-knowledge-sources'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface KnowledgeSourceCardProps {
  source: KnowledgeSourceItem
  onEdit: (source: KnowledgeSourceItem) => void
  onDelete: (source: KnowledgeSourceItem) => void
  onProcess: (source: KnowledgeSourceItem) => void
  onStop: (source: KnowledgeSourceItem) => void
  mutating: boolean
  processing: boolean
  stopping: boolean
}

const STATUS_STYLES: Record<
  KnowledgeSourceItem['status'],
  { className: string; label: string }
> = {
  ready: {
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    label: 'Ready',
  },
  processing: {
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    label: 'Processing',
  },
  cancelled: {
    className: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    label: 'Cancelled',
  },
  error: {
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
    label: 'Error',
  },
  pending: {
    className: '',
    label: 'Pending',
  },
  archived: {
    className: '',
    label: 'Archived',
  },
}

const SOURCE_TYPE_LABELS: Record<KnowledgeSourceItem['sourceType'], string> = {
  document: 'Document',
  pdf: 'PDF',
  url: 'URL',
  markdown: 'Markdown',
  faq: 'FAQ',
  openapi: 'OpenAPI',
  graphql: 'GraphQL',
  zip: 'Zip Archive',
  asyncapi: 'AsyncAPI',
  protobuf: 'Protobuf',
  rst: 'reStructuredText',
  asciidoc: 'AsciiDoc',
  csv: 'CSV',
  sql_ddl: 'SQL DDL',
  typescript_defs: 'TypeScript Defs',
  postman: 'Postman',
}

const STAGE_LABELS: Record<string, string> = {
  starting: 'Starting...',
  extracting: 'Extracting content...',
  chunking: 'Splitting into chunks...',
  embedding: 'Generating embeddings',
  storing: 'Saving to database...',
}

function formatDate(dateString: string | null) {
  if (!dateString) return null
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStopMessage(stage?: string) {
  if (stage === 'embedding') {
    return 'Cancelling the in-flight embedding request…'
  }

  if (stage === 'extracting' || stage === 'chunking') {
    return 'Waiting for the current extraction step to yield before stopping.'
  }

  if (stage === 'storing') {
    return 'Waiting for the current database write to finish before stopping.'
  }

  return 'Stopping the current processing run…'
}

function getWorkspaceImportLabel(metadata: Record<string, unknown> | null) {
  if (!metadata || typeof metadata !== 'object') return null

  const workspaceImport =
    'workspaceImport' in metadata
      ? metadata.workspaceImport
      : null

  if (!workspaceImport || typeof workspaceImport !== 'object') return null

  const record = workspaceImport as Record<string, unknown>
  if (record.kind === 'document') {
    const slug = typeof record.slug === 'string' && record.slug.trim()
      ? record.slug.trim()
      : null
    return slug
      ? `Imported from workspace document · ${slug}`
      : 'Imported from workspace document'
  }

  if (record.kind === 'openapi') {
    return 'Imported from workspace OpenAPI source'
  }

  return null
}

export function KnowledgeSourceCard({
  source,
  onEdit,
  onDelete,
  onProcess,
  onStop,
  mutating,
  processing,
  stopping,
}: KnowledgeSourceCardProps) {
  const status = STATUS_STYLES[source.status]
  const progress = getProcessingProgress(source)
  const stopRequested = Boolean(source.stopRequestedAt)
  const workspaceImportLabel = getWorkspaceImportLabel(source.metadata)

  const stageLabel = stopRequested
    ? 'Stop requested…'
    : progress
      ? STAGE_LABELS[progress.stage] ?? progress.stage
      : null
  const stageDetail =
    !stopRequested && progress?.detail && progress.stage === 'embedding'
      ? ` (${progress.detail})`
      : ''
  const pct = progress ? Math.round(progress.progress * 100) : 0
  const disableEditAction = mutating || source.status === 'processing'

  return (
    <article className="rounded-md border border-border/70 bg-background/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              {source.title}
            </h3>
            <Badge variant="outline">
              {SOURCE_TYPE_LABELS[source.sourceType]}
            </Badge>
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
          </div>
          {source.sourceUrl ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {source.sourceUrl}
            </p>
          ) : workspaceImportLabel ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {workspaceImportLabel}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {source.status === 'processing' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStop(source)}
              disabled={stopping || stopRequested}
            >
              {stopping || stopRequested ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <X data-icon="inline-start" />
              )}
              {stopping || stopRequested ? 'Stopping…' : 'Stop'}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onProcess(source)}
              disabled={processing}
            >
              {processing ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Reprocess
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <a
              href={`/api/ai/knowledge-sources/${encodeURIComponent(source.id)}/download`}
              download
            >
              <Download data-icon="inline-start" />
              Download
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(source)}
            disabled={disableEditAction}
          >
            <PencilLine data-icon="inline-start" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(source)}
            disabled={mutating}
          >
            <Trash2 data-icon="inline-start" />
            {source.status === 'processing' ? 'Force Delete' : 'Delete'}
          </Button>
        </div>
      </div>

      {source.status === 'processing' && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              {stageLabel}{stageDetail}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground/60">
              {pct}%
            </span>
          </div>
          <div
            className="h-1 rounded-sm bg-muted/40 overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-sm bg-amber-500/50 dark:bg-amber-400/40 transition-all duration-700 ease-out"
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
          {stopRequested ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {getStopMessage(progress?.stage)}
            </p>
          ) : null}
        </div>
      )}

      {source.status === 'error' && source.errorMessage ? (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {source.errorMessage}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Created {formatDate(source.createdAt)}</span>
        {source.processedAt ? (
          <span>Processed {formatDate(source.processedAt)}</span>
        ) : null}
      </div>
    </article>
  )
}
