import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { ApiTokensSettings } from '@/components/settings/api-tokens-settings'

export const metadata: Metadata = {
  title: 'API Tokens — Settings',
  description: 'Manage API tokens for CLI and CI/CD access.',
}

export default async function TokensSettingsPage() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) redirect('/auth/signin')

  return <ApiTokensSettings workspaceId={result.ctx.workspaceId} />
}
