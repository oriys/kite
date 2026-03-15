'use client'

import * as React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useDocCompare, type CompareMode } from '@/hooks/use-doc-compare'
import { type Doc } from '@/lib/documents'
import { Button } from '@/components/ui/button'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { DocCompareToolbar } from '@/components/docs/doc-compare-toolbar'
import { DocComparePanel } from '@/components/docs/doc-compare-panel'
import { DocDiffView, DiffStats } from '@/components/docs/doc-diff-view'
import { Skeleton } from '@/components/ui/skeleton'
import { useMounted } from '@/hooks/use-mounted'

export function DocComparePageClient() {
  const mounted = useMounted()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialDocId = searchParams.get('doc')
  const initialMode = (searchParams.get('mode') as CompareMode) || 'version'
  const initialRight = searchParams.get('right')

  const compare = useDocCompare({
    initialDocId,
    initialMode,
  })

  // If a right doc was specified via URL, set it
  React.useEffect(() => {
    if (initialRight && initialMode === 'document') {
      compare.setRightDocId(initialRight)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Document list for compare selectors
  const [allDocs, setAllDocs] = React.useState<{ id: string; title: string }[]>([])
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/documents')
        if (!res.ok) return
        const data = (await res.json()) as Doc[]
        if (!cancelled) {
          setAllDocs(data.map((d) => ({ id: d.id, title: d.title })))
        }
      } catch (error) {
        console.warn('[doc-compare] Failed to load documents:', error)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // Scroll sync
  const leftScrollRef = React.useRef<HTMLDivElement>(null)
  const rightScrollRef = React.useRef<HTMLDivElement>(null)
  const syncingRef = React.useRef(false)

  const handleLeftScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncingRef.current) return
    syncingRef.current = true
    const target = e.currentTarget
    if (rightScrollRef.current) {
      const ratio = target.scrollTop / (target.scrollHeight - target.clientHeight || 1)
      rightScrollRef.current.scrollTop = ratio * (rightScrollRef.current.scrollHeight - rightScrollRef.current.clientHeight)
    }
    requestAnimationFrame(() => { syncingRef.current = false })
  }, [])

  const handleRightScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncingRef.current) return
    syncingRef.current = true
    const target = e.currentTarget
    if (leftScrollRef.current) {
      const ratio = target.scrollTop / (target.scrollHeight - target.clientHeight || 1)
      leftScrollRef.current.scrollTop = ratio * (leftScrollRef.current.scrollHeight - leftScrollRef.current.clientHeight)
    }
    requestAnimationFrame(() => { syncingRef.current = false })
  }, [])

  if (!mounted) {
    return <CompareSkeleton />
  }

  if (compare.loading && !compare.left.doc) {
    return <CompareSkeleton />
  }

  const hasContent = compare.left.content || compare.right.content

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/50 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => router.push('/docs')}
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
            <div className="h-5 w-px bg-border/60" />
            <h1 className="text-sm font-semibold tracking-tight text-foreground">
              Compare Documents
            </h1>
            {hasContent && compare.viewMode === 'diff' && (
              <DiffStats
                leftContent={compare.left.content}
                rightContent={compare.right.content}
                className="ml-2"
              />
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-border/60 bg-muted/20 px-4 py-2.5 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <DocCompareToolbar
            mode={compare.mode}
            onModeChange={compare.setMode}
            baseDocuments={allDocs}
            baseDocId={compare.baseDocId}
            onBaseDocChange={(id) => {
              compare.setBaseDocId(id)
              compare.setLeftDocId(id)
            }}
            versions={compare.versions}
            leftVersionId={compare.leftVersionId}
            onLeftVersionChange={compare.setLeftVersionId}
            rightVersionId={compare.rightVersionId}
            onRightVersionChange={compare.setRightVersionId}
            currentLocale={compare.currentLocale}
            translations={compare.translations}
            rightLocaleDocId={compare.rightLocaleDocId}
            onRightLocaleChange={compare.setRightLocaleDocId}
            documents={allDocs}
            leftDocId={compare.leftDocId}
            onLeftDocChange={(id) => {
              compare.setLeftDocId(id)
              compare.setBaseDocId(id)
            }}
            rightDocId={compare.rightDocId}
            onRightDocChange={compare.setRightDocId}
            viewMode={compare.viewMode}
            onViewModeChange={compare.setViewMode}
            onSwap={compare.swap}
          />
        </div>
      </div>

      {/* Split panels */}
      <div className="flex-1 min-h-0">
        {compare.viewMode === 'diff' && hasContent ? (
          <div className="h-full overflow-auto">
            <DocDiffView
              leftContent={compare.left.content}
              rightContent={compare.right.content}
              className="min-h-full"
            />
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50} minSize={25}>
              <DocComparePanel
                side={compare.left}
                label={compare.left.label}
                scrollRef={leftScrollRef}
                onScroll={handleLeftScroll}
                className="h-full"
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={25}>
              <DocComparePanel
                side={compare.right}
                label={compare.right.label}
                scrollRef={rightScrollRef}
                onScroll={handleRightScroll}
                className="h-full"
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  )
}

function CompareSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 bg-card/50 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-[1600px] flex items-center gap-3">
          <Skeleton className="h-8 w-16" />
          <div className="h-5 w-px bg-border/60" />
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <div className="border-b border-border/60 bg-muted/20 px-4 py-2.5 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <Skeleton className="h-8 w-96" />
        </div>
      </div>
      <div className="flex flex-1 min-h-0 divide-x divide-border/60">
        <div className="flex-1 p-6 space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
        <div className="flex-1 p-6 space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
    </div>
  )
}
