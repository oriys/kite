import type { Metadata } from 'next'

import { FeatureGuard } from '@/components/docs/feature-guard'
import { DocAiPromptManagerPage } from '@/components/docs/doc-ai-prompt-manager-page'

export const metadata: Metadata = {
  title: 'AI Prompts — Settings',
  description: 'Manage the AI prompts used by editor actions across this workspace.',
}

export default function DocAiPromptsPage() {
  return (
    <FeatureGuard featureId="aiWorkspace">
      <DocAiPromptManagerPage />
    </FeatureGuard>
  )
}
