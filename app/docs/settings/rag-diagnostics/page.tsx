import type { Metadata } from 'next'

import { FeatureGuard } from '@/components/docs/feature-guard'
import { DocRagDiagnosticsPage } from '@/components/docs/doc-rag-diagnostics-page'
import { requireWorkspacePageAuth } from '@/lib/workspace-page-auth'

export const metadata: Metadata = {
  title: 'RAG Diagnostics — Settings',
  description: 'Debug and inspect the retrieval-augmented generation pipeline.',
}

export default async function RagDiagnosticsSettingsPage() {
  await requireWorkspacePageAuth('owner')

  return (
    <FeatureGuard featureId="aiWorkspace">
      <DocRagDiagnosticsPage />
    </FeatureGuard>
  )
}
