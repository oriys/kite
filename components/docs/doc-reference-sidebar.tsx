'use client'

import * as React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { BookOpenText, Search, X } from 'lucide-react'

import { useDocument, useDocuments } from '@/hooks/use-documents'
import { type Doc, STATUS_CONFIG } from '@/lib/documents'
import { cn } from '@/lib/utils'
import { MarkdownPreview } from '@/components/docs/markdown-preview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

interface DocReferenceSidebarProps {
  activeDocumentId: string
  referenceDocumentId: string | null
  onReferenceDocumentChange: (documentId: string | null) => void
  onClose?: () => void
  className?: string
}

function getReferencePreview(doc: Doc) {
  const raw = (doc.summary || doc.preview || doc.content)
    .replace(/\s+/g, ' ')
    .trim()

  if (!raw) return 'Empty document'
  return raw.length > 90 ? `${raw.slice(0, 89).trimEnd()}…` : raw
}

export function DocReferenceSidebar({
  activeDocumentId,
  referenceDocumentId,
  onReferenceDocumentChange,
  onClose,
  className,
}: DocReferenceSidebarProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('')
  const autoOpenedPickerRef = React.useRef(false)
  const { items, loading: listLoading } = useDocuments(
    undefined,
    undefined,
    debouncedSearchQuery,
  )
  const { doc: referenceDoc, loading: referenceLoading } = useDocument(referenceDocumentId)

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim())
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [searchQuery])

  React.useEffect(() => {
    if (referenceDocumentId || autoOpenedPickerRef.current) {
      return
    }

    autoOpenedPickerRef.current = true
    const frame = window.requestAnimationFrame(() => {
      setPickerOpen(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [referenceDocumentId])

  const selectableDocuments = React.useMemo(
    () => items.filter((document) => document.id !== activeDocumentId),
    [activeDocumentId, items],
  )

  const handleSelectDocument = React.useCallback(
    (documentId: string) => {
      onReferenceDocumentChange(documentId)
      setPickerOpen(false)
      setSearchQuery('')
      setDebouncedSearchQuery('')
    },
    [onReferenceDocumentChange],
  )

  return (
    <>
      <div
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <BookOpenText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Reference</span>
            {referenceDocumentId ? (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                Read-only
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {referenceDocumentId ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={() => onReferenceDocumentChange(null)}
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => setPickerOpen(true)}
            >
              <Search className="h-3 w-3" />
              {referenceDoc ? 'Switch' : 'Open'}
            </Button>
            {onClose ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                aria-label="Close reference panel"
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>

        {referenceLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : referenceDoc ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border/50 px-4 py-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {referenceDoc.title || 'Untitled'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {getReferencePreview(referenceDoc)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {STATUS_CONFIG[referenceDoc.status].label}
                </Badge>
                {referenceDoc.locale ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {referenceDoc.locale}
                  </Badge>
                ) : null}
                <span className="text-[11px] text-muted-foreground">
                  Updated{' '}
                  {formatDistanceToNow(new Date(referenceDoc.updatedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-4 sm:p-5">
                <MarkdownPreview content={referenceDoc.content} />
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
            <div className="rounded-full border border-border/60 bg-muted/30 p-3">
              <BookOpenText className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Open another document</p>
              <p className="text-xs leading-relaxed">
                Keep a second doc visible while editing this one.
              </p>
            </div>
            <Button size="sm" className="h-8 gap-1.5" onClick={() => setPickerOpen(true)}>
              <Search className="h-3.5 w-3.5" />
              Choose document
            </Button>
          </div>
        )}
      </div>

      <CommandDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Open reference document"
        description="Select another document to keep beside the editor."
      >
        <CommandInput
          placeholder="Search documents…"
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          {listLoading ? (
            <div className="px-3 py-6 text-sm text-muted-foreground">
              Loading documents…
            </div>
          ) : null}
          {!listLoading ? (
            <CommandEmpty>
              {debouncedSearchQuery
                ? 'No matching documents found.'
                : 'No other documents are available yet.'}
            </CommandEmpty>
          ) : null}
          <CommandGroup heading="Documents">
            {selectableDocuments.map((document) => (
              <CommandItem
                key={document.id}
                value={`${document.title} ${document.summary ?? ''} ${document.locale ?? ''}`}
                onSelect={() => handleSelectDocument(document.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">
                    {document.title || 'Untitled'}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {getReferencePreview(document)}
                  </div>
                </div>
                <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                  {STATUS_CONFIG[document.status].label}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
