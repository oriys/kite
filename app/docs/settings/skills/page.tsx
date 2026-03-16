import type { Metadata } from 'next'

import { FeatureGuard } from '@/components/docs/feature-guard'
import { DocSkillsManagerPage } from '@/components/docs/doc-skills-manager-page'
import { requireWorkspacePageAuth } from '@/lib/workspace-page-auth'

export const metadata: Metadata = {
  title: 'CLI Skills — Settings',
  description: 'Manage Copilot CLI skills for terminal session bootstrap.',
}

export default async function SkillsSettingsPage() {
  await requireWorkspacePageAuth('admin')

  return (
    <FeatureGuard featureId="aiWorkspace">
      <DocSkillsManagerPage />
    </FeatureGuard>
  )
}
