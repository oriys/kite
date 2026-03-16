import type { Metadata } from 'next'
import { ApiTokensSettings } from '@/components/settings/api-tokens-settings'
import { requireWorkspacePageAuth } from '@/lib/workspace-page-auth'

export const metadata: Metadata = {
  title: 'API Tokens — Settings',
  description: 'Manage API tokens for CLI and CI/CD access.',
}

export default async function TokensSettingsPage() {
  const ctx = await requireWorkspacePageAuth('member')

  return <ApiTokensSettings workspaceId={ctx.workspaceId} />
}
