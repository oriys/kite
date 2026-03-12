'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Download, Plus, Search, X } from 'lucide-react'

import {
  isDocumentTitleMissing,
  type DocStatus,
  STATUS_CONFIG,
} from '@/lib/documents'
import {
  clearPendingDocumentSummary,
  getPendingDocumentSummaryIds,
} from '@/lib/document-summary-queue'
import { useDocuments } from '@/hooks/use-documents'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DocList } from '@/components/docs/doc-list'
import { getDocEditorHref } from '@/lib/docs-url'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const statuses: (DocStatus | 'all')[] = ['all', 'draft', 'review', 'published', 'archived']
const LEGACY_DOCS_STORAGE_KEY = 'editorial-docs'
const LEGACY_DOCS_IMPORTED_KEY = 'editorial-docs-imported'
const LEGACY_DOCS_DISMISSED_KEY = 'editorial-docs-import-dismissed'
const SUMMARY_REFRESH_INTERVAL_MS = 1500
const SUMMARY_REFRESH_MAX_ATTEMPTS = 6

interface LegacyDocVersion {
  content: string
  savedAt?: string
  wordCount?: number
}

interface LegacyDoc {
  title?: string
  content?: string
  status?: DocStatus
  createdAt?: string
  updatedAt?: string
  versions?: LegacyDocVersion[]
}

function readLegacyDocs(): LegacyDoc[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(LEGACY_DOCS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((doc): doc is LegacyDoc => Boolean(doc && typeof doc === 'object'))
  } catch {
    return []
  }
}

export default function DocsPage() {
  const router = useRouter()
  const [filter, setFilter] = React.useState<DocStatus | 'all'>('all')
  const { items, loading, create, remove, refresh } = useDocuments()
  const [newTitle, setNewTitle] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [legacyDocs, setLegacyDocs] = React.useState<LegacyDoc[]>([])
  const [importingLegacyDocs, setImportingLegacyDocs] = React.useState(false)
  const [legacyImportMessage, setLegacyImportMessage] = React.useState<string | null>(null)
  const pendingSummaryRefreshRef = React.useRef(false)

  const filteredItems = React.useMemo(
    () => {
      let result = filter === 'all' ? items : items.filter((doc) => doc.status === filter)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        result = result.filter(
          (doc) =>
            doc.title.toLowerCase().includes(q) ||
            doc.content.toLowerCase().includes(q),
        )
      }
      return result
    },
    [filter, items, searchQuery],
  )

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: items.length }
    for (const s of Object.keys(STATUS_CONFIG)) {
      c[s] = items.filter((d) => d.status === s).length
    }
    return c
  }, [items])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(LEGACY_DOCS_IMPORTED_KEY)) return
    if (window.localStorage.getItem(LEGACY_DOCS_DISMISSED_KEY)) return

    setLegacyDocs(readLegacyDocs())
  }, [])

  React.useEffect(() => {
    if (loading || pendingSummaryRefreshRef.current) return

    const queuedIds = getPendingDocumentSummaryIds()
    if (queuedIds.length === 0) return

    pendingSummaryRefreshRef.current = true

    let cancelled = false
    let timer: number | null = null

    const syncQueuedSummaries = async (attempt: number) => {
      const docs = await refresh({ silent: true })
      if (cancelled) return

      for (const queuedId of getPendingDocumentSummaryIds()) {
        const queuedDoc = docs.find((doc) => doc.id === queuedId)
        if (
          !queuedDoc ||
          !queuedDoc.content.trim() ||
          (queuedDoc.summary.trim() && !isDocumentTitleMissing(queuedDoc.title))
        ) {
          clearPendingDocumentSummary(queuedId)
        }
      }

      const remainingIds = getPendingDocumentSummaryIds()
      if (remainingIds.length === 0 || attempt + 1 >= SUMMARY_REFRESH_MAX_ATTEMPTS) {
        pendingSummaryRefreshRef.current = false
        return
      }

      timer = window.setTimeout(() => {
        void syncQueuedSummaries(attempt + 1)
      }, SUMMARY_REFRESH_INTERVAL_MS)
    }

    timer = window.setTimeout(() => {
      void syncQueuedSummaries(0)
    }, SUMMARY_REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      pendingSummaryRefreshRef.current = false
      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [loading, refresh])

  const dismissLegacyImport = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LEGACY_DOCS_DISMISSED_KEY, new Date().toISOString())
    }
    setLegacyDocs([])
    setLegacyImportMessage(null)
  }, [])

  const handleImportLegacyDocs = React.useCallback(async () => {
    if (legacyDocs.length === 0) return

    setImportingLegacyDocs(true)
    setLegacyImportMessage(null)

    const payload = legacyDocs
      .map((doc) => ({
        title: typeof doc.title === 'string' ? doc.title : 'Untitled',
        content: typeof doc.content === 'string' ? doc.content : '',
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        versions: Array.isArray(doc.versions)
          ? doc.versions
              .filter(
                (version): version is LegacyDocVersion =>
                  Boolean(version && typeof version.content === 'string'),
              )
              .map((version) => ({
                content: version.content,
                savedAt: version.savedAt,
                wordCount: version.wordCount,
              }))
          : [],
      }))
      .filter((doc) => doc.content.length > 0 || doc.title !== 'Untitled')

    try {
      const res = await fetch('/api/documents/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: payload }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error(
          typeof error?.error === 'string' ? error.error : 'Failed to import local documents',
        )
      }

      const data = await res.json()
      await refresh()

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LEGACY_DOCS_IMPORTED_KEY, new Date().toISOString())
      }

      setLegacyDocs([])
      setLegacyImportMessage(
        `Imported ${data.importedCount ?? payload.length} local document${(data.importedCount ?? payload.length) === 1 ? '' : 's'}.`,
      )
    } catch (error) {
      setLegacyImportMessage(
        error instanceof Error ? error.message : 'Failed to import local documents',
      )
    } finally {
      setImportingLegacyDocs(false)
    }
  }, [legacyDocs, refresh])

  const handleCreate = async () => {
    const title = newTitle.trim() || 'Untitled'
    const doc = await create(title, '')
    setNewTitle('')
    setDialogOpen(false)
    router.push(getDocEditorHref(doc.id))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, edit, review, and publish your API documentation.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8">
                <Plus className="mr-1.5 size-3.5" />
                New Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Document</DialogTitle>
                <DialogDescription>
                  Give your document a title. You can change it later.
                </DialogDescription>
              </DialogHeader>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Document title…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                }}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status filter tabs */}
      {legacyDocs.length > 0 && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/35 px-4 py-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Found {legacyDocs.length} local document{legacyDocs.length === 1 ? '' : 's'} from the old editor
            </p>
            <p className="text-sm text-muted-foreground">
              Import them into your current workspace so your previous content shows up again.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleImportLegacyDocs}
              disabled={importingLegacyDocs}
            >
              <Download className="mr-1.5 size-3.5" />
              {importingLegacyDocs ? 'Importing…' : 'Import local docs'}
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={dismissLegacyImport} aria-label="Dismiss import notice">
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {legacyImportMessage && (
        <div className="mb-4 rounded-lg border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
          {legacyImportMessage}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                filter === s
                  ? 'bg-accent/50 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
              <Badge variant="secondary" className="ml-0.5 h-4 min-w-[1rem] px-1 text-[10px]">
                {counts[s] ?? 0}
              </Badge>
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents…"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Document grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="size-5 motion-safe:animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        </div>
      ) : (
        <DocList documents={filteredItems} onDelete={remove} />
      )}
    </div>
  )
}
