import type { Metadata } from 'next'

import { FeatureGuard } from '@/components/docs/feature-guard'
import { DocKnowledgeBaseManagerPage } from '@/components/docs/doc-knowledge-base-manager-page'
import { requireWorkspacePageAuth } from '@/lib/workspace-page-auth'

export const metadata: Metadata = {
  title: 'Knowledge Base — Settings',
  description: 'Manage knowledge sources for AI-powered search and chat.',
}

export default async function KnowledgeBaseSettingsPage() {
  await requireWorkspacePageAuth('admin')

  return (
    <FeatureGuard featureId="aiWorkspace">
      <DocKnowledgeBaseManagerPage />
    </FeatureGuard>
  )
}
