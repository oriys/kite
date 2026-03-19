'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpDown, ListFilter, Plus, Search, Tag } from 'lucide-react'

import {
  DOCUMENT_SORT_OPTIONS,
  isDocumentTitleMissing,
  type DocStatus,
  STATUS_CONFIG,
  getDocEditorHref,
  type DocumentSort,
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
import { TemplatePicker } from '@/components/template-picker'
import { usePersonalSettings } from '@/components/personal-settings-provider'
import { useMounted } from '@/hooks/use-mounted'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const statuses: (DocStatus | 'all')[] = ['all', 'draft', 'review', 'published', 'archived']
const SUMMARY_REFRESH_INTERVAL_MS = 1500
const SUMMARY_REFRESH_MAX_ATTEMPTS = 6
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
const ALL_CATEGORIES_VALUE = '__all_categories__'
const ALL_TAGS_VALUE = '__all_tags__'

export default function DocsPage() {
  const mounted = useMounted()
  const router = useRouter()
  const { featureVisibility } = usePersonalSettings()
  const [filter, setFilter] = React.useState<DocStatus | 'all'>('all')
  const [currentVersionId, setCurrentVersionId] = React.useState<string | null>(null)
  const [newTitle, setNewTitle] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('')
  const [sort, setSort] = React.useState<DocumentSort>('updated_desc')
  const [pageSize, setPageSize] = React.useState<number>(20)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [categoryFilter, setCategoryFilter] = React.useState('')
  const [tagFilter, setTagFilter] = React.useState('')
  const pendingSummaryRefreshRef = React.useRef(false)
  const {
    items,
    counts,
    categories,
    tags: availableTags,
    pagination,
    loading,
    create,
    remove,
    refresh,
  } = useDocuments(
    filter === 'all' ? undefined : filter,
    currentVersionId,
    debouncedSearchQuery,
    {
      category: categoryFilter,
      tag: tagFilter,
      page: currentPage,
      pageSize,
      sort,
    },
  )

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim())
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [searchQuery])

  React.useEffect(() => {
    setCurrentPage(1)
  }, [categoryFilter, currentVersionId, debouncedSearchQuery, filter, pageSize, sort, tagFilter])

  React.useEffect(() => {
    if (currentPage > pagination.totalPages) {
      setCurrentPage(pagination.totalPages)
    }
  }, [currentPage, pagination.totalPages])

  React.useEffect(() => {
    if (debouncedSearchQuery) return
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
          (
            queuedDoc.summary.trim().length > 0 ||
            !isDocumentTitleMissing(queuedDoc.title)
          )
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
  }, [debouncedSearchQuery, loading, refresh])

  const handleCreate = async () => {
    const title = newTitle.trim() || 'Untitled'
    const doc = await create(title, '')
    setNewTitle('')
    setDialogOpen(false)
    router.push(getDocEditorHref(doc))
  }

  const controlPlaceholderClassName =
    'h-8 rounded-md border border-input/80 bg-background/80 px-3 text-xs text-muted-foreground'

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, edit, review, and publish your API documentation.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {featureVisibility.templates ? <TemplatePicker /> : null}
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
      <div className="mb-5 space-y-3 border-b border-border/60 pb-3">
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
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <VersionSwitcher
            currentVersionId={currentVersionId ?? undefined}
            onVersionChange={setCurrentVersionId}
            className="h-8 text-xs"
          />
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents…"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-4 lg:ml-auto lg:flex lg:items-center">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 items-center gap-1 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                <ListFilter className="size-3.5" />
                Category
              </span>
              {mounted ? (
                <Select
                  value={categoryFilter || ALL_CATEGORIES_VALUE}
                  onValueChange={(value) =>
                    setCategoryFilter(
                      value === ALL_CATEGORIES_VALUE ? '' : value,
                    )
                  }
                >
                  <SelectTrigger size="sm" className="h-8 min-w-[150px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value={ALL_CATEGORIES_VALUE}>All categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className={cn(controlPlaceholderClassName, 'min-w-[150px]')}>
                  {categoryFilter || 'All categories'}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 items-center gap-1 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                <Tag className="size-3.5" />
                Tag
              </span>
              {mounted ? (
                <Select
                  value={tagFilter || ALL_TAGS_VALUE}
                  onValueChange={(value) => setTagFilter(value === ALL_TAGS_VALUE ? '' : value)}
                >
                  <SelectTrigger size="sm" className="h-8 min-w-[150px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value={ALL_TAGS_VALUE}>All tags</SelectItem>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className={cn(controlPlaceholderClassName, 'min-w-[150px]')}>
                  {tagFilter || 'All tags'}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 items-center gap-1 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                <ArrowUpDown className="size-3.5" />
                Sort
              </span>
              {mounted ? (
                <Select
                  value={sort}
                  onValueChange={(value) => setSort(value as DocumentSort)}
                >
                  <SelectTrigger size="sm" className="h-8 min-w-[170px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {DOCUMENT_SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className={cn(controlPlaceholderClassName, 'min-w-[170px]')}>
                  {DOCUMENT_SORT_OPTIONS.find((option) => option.value === sort)?.label}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 items-center gap-1 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase whitespace-nowrap">
                <ListFilter className="size-3.5" />
                Per page
              </span>
              {mounted ? (
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => setPageSize(Number(value))}
                >
                  <SelectTrigger size="sm" className="h-8 min-w-[112px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} per page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className={cn(controlPlaceholderClassName, 'min-w-[112px]')}>
                  {pageSize} per page
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="size-5 motion-safe:animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        </div>
      ) : (
        <DocList
          documents={items}
          totalDocuments={pagination.total}
          currentPage={pagination.page}
          pageSize={pagination.pageSize}
          totalPages={pagination.totalPages}
          onPageChange={setCurrentPage}
          onDelete={remove}
        />
      )}

    </div>
  )
}
