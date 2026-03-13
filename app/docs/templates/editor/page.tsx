import { Suspense } from 'react'

import { FeatureGuard } from '@/components/docs/feature-guard'
import { Skeleton } from '@/components/ui/skeleton'
import { TemplateEditorPageClient } from '@/components/templates/template-editor-page'

function TemplateEditorPageFallback() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Skeleton className="mb-4 h-10 w-2/3" />
      <Skeleton className="h-[600px] w-full rounded-md" />
    </div>
  )
}

export default function TemplateEditorPage() {
  return (
    <FeatureGuard featureId="templates">
      <Suspense fallback={<TemplateEditorPageFallback />}>
        <TemplateEditorPageClient />
      </Suspense>
    </FeatureGuard>
  )
}
