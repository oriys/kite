'use client'

import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  GitCompareArrows,
  Tag,
  Trash2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { type Doc, getDocEditorHref, getStatusConfig } from '@/lib/documents'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface DocListProps {
  documents: Doc[]
  totalDocuments: number
  currentPage: number
  pageSize: number
  totalPages: number
  onPageChange: (page: number) => void
  onDelete: (id: string) => void
  className?: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function buildVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, totalPages]
  }

  if (currentPage >= totalPages - 2) {
    return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, currentPage - 1, currentPage, currentPage + 1, totalPages]
}

export function DocList({
  documents,
  totalDocuments,
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
  onDelete,
  className,
}: DocListProps) {
  if (totalDocuments === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-20 text-center', className)}>
        <div className="rounded-full bg-muted/60 p-4 mb-4">
          <FileText className="size-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No documents found</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Create a new document to start writing, or adjust your filters above.
        </p>
      </div>
    )
  }

  const pageStart = (currentPage - 1) * pageSize + 1
  const pageEnd = Math.min(totalDocuments, pageStart + documents.length - 1)
  const visiblePages = buildVisiblePages(currentPage, totalPages)

  return (
    <div className={cn('space-y-4', className)}>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.24)]">
        <div className="hidden items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase lg:grid lg:grid-cols-[minmax(0,1.9fr)_160px_120px_84px]">
          <span>Document</span>
          <span>Status</span>
          <span>Updated</span>
          <span className="text-right">Actions</span>
        </div>

        <div className="divide-y divide-border/60">
          {documents.map((doc) => {
            const config = getStatusConfig(doc.status)

            return (
              <div
                key={doc.id}
                className="group grid gap-3 px-3 py-3 transition-colors hover:bg-muted/25 lg:grid-cols-[minmax(0,1.9fr)_160px_120px_84px] lg:items-center lg:px-4"
              >
                <Link
                  href={getDocEditorHref(doc)}
                  className="block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-5 text-foreground transition-colors group-hover:text-accent-foreground">
                      {doc.title || 'Untitled'}
                    </p>
                    {doc.category || doc.tags.length > 0 ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                        {doc.category ? (
                          <Badge
                            variant="secondary"
                            className="h-5 rounded-md px-1.5 text-[10px] font-medium"
                          >
                            {doc.category}
                          </Badge>
                        ) : null}
                        {doc.tags.length > 0 ? <Tag className="size-3 text-muted-foreground" /> : null}
                        {doc.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="h-5 rounded-md border-border/60 bg-background/60 px-1.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {doc.tags.length > 3 ? (
                          <Badge
                            variant="outline"
                            className="h-5 rounded-md border-border/60 bg-background/60 px-1.5 text-[10px] font-medium text-muted-foreground"
                          >
                            +{doc.tags.length - 3}
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </Link>

                <div className="flex items-center lg:justify-start">
                  <StatusBadge
                    label={config.label}
                    tone={config.tone as StatusTone}
                    compact
                  />
                </div>

                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="size-3" />
                  {formatDate(doc.updatedAt)}
                </div>

                <div className="flex items-center justify-end gap-1">
                  <Button asChild variant="ghost" size="icon-sm">
                    <Link
                      href={`/docs/compare?doc=${encodeURIComponent(doc.id)}&mode=version`}
                      aria-label={`Compare ${doc.title}`}
                    >
                      <GitCompareArrows className="size-3.5 text-muted-foreground" />
                    </Link>
                  </Button>
                  {doc.canDelete ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${doc.title}`}
                        >
                          <Trash2 className="size-3.5 text-muted-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete document</AlertDialogTitle>
                          <AlertDialogDescription>
                            Permanently delete &ldquo;{doc.title}&rdquo;? This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => onDelete(doc.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/15 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-muted-foreground">
          Showing <span className="font-medium text-foreground">{pageStart}</span>-
          <span className="font-medium text-foreground">{pageEnd}</span> of{' '}
          <span className="font-medium text-foreground">{totalDocuments}</span> documents
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft className="size-3" />
            Prev
          </Button>
          {visiblePages.map((page, index) => {
            const previousPage = visiblePages[index - 1]
            const showGap = previousPage !== undefined && page - previousPage > 1

            return (
              <div key={page} className="flex items-center gap-1.5">
                {showGap ? (
                  <span className="px-1 text-xs text-muted-foreground">…</span>
                ) : null}
                <Button
                  variant={page === currentPage ? 'outline' : 'ghost'}
                  size="icon-sm"
                  className="h-7 w-7"
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </Button>
              </div>
            )
          })}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
            <ChevronRight className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
