'use client'

import { Download, Loader2, PencilLine, RefreshCw, Trash2 } from 'lucide-react'

import type { KnowledgeSourceItem } from '@/hooks/use-knowledge-sources'
import { getProcessingProgress } from '@/hooks/use-knowledge-sources'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface KnowledgeSourceCardProps {
  source: KnowledgeSourceItem
  onEdit: (source: KnowledgeSourceItem) => void
  onDelete: (source: KnowledgeSourceItem) => void
  onProcess: (source: KnowledgeSourceItem) => void
  mutating: boolean
  processing: boolean
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

export function KnowledgeSourceCard({
  source,
  onEdit,
  onDelete,
  onProcess,
  mutating,
  processing,
}: KnowledgeSourceCardProps) {
  const status = STATUS_STYLES[source.status]
  const progress = getProcessingProgress(source)

  const stageLabel = progress
    ? STAGE_LABELS[progress.stage] ?? progress.stage
    : null
  const stageDetail =
    progress?.detail && progress.stage === 'embedding'
      ? ` (${progress.detail})`
      : ''
  const pct = progress ? Math.round(progress.progress * 100) : 0

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
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onProcess(source)}
            disabled={mutating || processing}
          >
            {processing ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Reprocess
          </Button>
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
          >
            <PencilLine data-icon="inline-start" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(source)}
          >
            <Trash2 data-icon="inline-start" />
            Delete
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
