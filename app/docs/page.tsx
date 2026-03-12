'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'

import {
  isDocumentTitleMissing,
  type DocStatus,
  STATUS_CONFIG,
  getDocEditorHref,
} from '@/lib/documents'
import {
  clearPendingDocumentSummary,
  getPendingDocumentSummaryIds,
} from '@/lib/document-summary-queue'
import { useDocuments } from '@/hooks/use-documents'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DocList } from '@/components/docs/doc-list'
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
import { VersionSwitcher } from '@/components/version-switcher'

const statuses: (DocStatus | 'all')[] = ['all', 'draft', 'review', 'published', 'archived']
const SUMMARY_REFRESH_INTERVAL_MS = 1500
const SUMMARY_REFRESH_MAX_ATTEMPTS = 6

export default function DocsPage() {
  const router = useRouter()
  const [filter, setFilter] = React.useState<DocStatus | 'all'>('all')
  const [currentVersionId, setCurrentVersionId] = React.useState<string | null>(null)
  const { items, loading, create, remove, refresh } = useDocuments(undefined, currentVersionId)
  const [newTitle, setNewTitle] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
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
        <VersionSwitcher
          currentVersionId={currentVersionId ?? undefined}
          onVersionChange={setCurrentVersionId}
          className="h-8 text-xs"
        />
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
