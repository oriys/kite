import type { Metadata } from 'next'

import { FeatureGuard } from '@/components/docs/feature-guard'
import { DocAiManagerPage } from '@/components/docs/doc-ai-manager-page'

export const metadata: Metadata = {
  title: 'AI Models — Settings',
  description: 'Manage which AI models are enabled inside the editor.',
}

export default function DocAiPage() {
  return (
    <FeatureGuard featureId="aiWorkspace">
      <DocAiManagerPage />
    </FeatureGuard>
  )
}
