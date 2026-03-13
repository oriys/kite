import { Suspense } from 'react'
import { DocComparePageClient } from '@/components/docs/doc-compare-page'
import { Skeleton } from '@/components/ui/skeleton'

function ComparePageFallback() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 bg-card/50 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-[1600px] flex items-center gap-3">
          <Skeleton className="h-8 w-16" />
          <div className="h-5 w-px bg-border/60" />
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <div className="flex flex-1 min-h-0 divide-x divide-border/60">
        <div className="flex-1 p-6 space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="flex-1 p-6 space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  )
}

export default function DocComparePage() {
  return (
    <Suspense fallback={<ComparePageFallback />}>
      <DocComparePageClient />
    </Suspense>
  )
}
