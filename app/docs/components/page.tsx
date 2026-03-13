import type { Metadata } from 'next'

import { FeatureGuard } from '@/components/docs/feature-guard'
import { DocSnippetManagerPage } from '@/components/docs/doc-snippet-manager-page'

export const metadata: Metadata = {
  title: 'Quick Insert Components — Editorial System',
  description: 'Manage quick insert components for the document editor.',
}

export default function DocComponentsPage() {
  return (
    <FeatureGuard featureId="quickInsert">
      <DocSnippetManagerPage />
    </FeatureGuard>
  )
}
