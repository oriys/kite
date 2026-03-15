import { Suspense } from 'react'

import { DocEditorPageClient } from '@/components/docs/doc-editor-page'
import { Skeleton } from '@/components/ui/skeleton'

function EditorPageFallback() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Skeleton className="mb-4 h-10 w-2/3" />
      <Skeleton className="h-[600px] w-full rounded-md" />
    </div>
  )
}

export default function DocEditorSlugPage() {
  return (
    <Suspense fallback={<EditorPageFallback />}>
      <DocEditorPageClient />
    </Suspense>
  )
}
