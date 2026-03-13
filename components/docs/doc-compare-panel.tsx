'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MarkdownPreview } from '@/components/docs/markdown-preview'
import { type CompareSide } from '@/hooks/use-doc-compare'
import { Skeleton } from '@/components/ui/skeleton'

interface DocComparePanelProps {
  side: CompareSide
  label: string
  className?: string
  /** Ref forwarded for scroll sync */
  scrollRef?: React.RefObject<HTMLDivElement | null>
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
}

export function DocComparePanel({
  side,
  label,
  className,
  scrollRef,
  onScroll,
}: DocComparePanelProps) {
  if (side.loading) {
    return (
      <div className={cn('flex flex-col', className)}>
        <PanelHeader title="" label={label} loading />
        <div className="flex-1 p-4 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    )
  }

  if (!side.content && !side.doc) {
    return (
      <div className={cn('flex flex-col', className)}>
        <PanelHeader title="" label={label} />
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-muted-foreground italic">
            Select a document to compare
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <PanelHeader
        title={side.title}
        label={label}
        locale={side.doc?.locale ?? undefined}
        status={side.doc?.status}
      />
      <ScrollArea className="flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="p-4 sm:p-6"
        >
          <MarkdownPreview content={side.content} />
        </div>
      </ScrollArea>
    </div>
  )
}

function PanelHeader({
  title,
  label,
  locale,
  status,
  loading,
}: {
  title: string
  label: string
  locale?: string
  status?: string
  loading?: boolean
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2">
      <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wider">
        {label}
      </Badge>
      {loading ? (
        <Skeleton className="h-4 w-32" />
      ) : (
        <span className="truncate text-sm font-medium text-foreground">
          {title || 'Untitled'}
        </span>
      )}
      {locale && (
        <Badge variant="secondary" className="text-[10px] ml-auto">
          {locale}
        </Badge>
      )}
      {status && (
        <Badge variant="secondary" className="text-[10px] capitalize">
          {status}
        </Badge>
      )}
    </div>
  )
}
