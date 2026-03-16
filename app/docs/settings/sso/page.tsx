import type { Metadata } from 'next'
import { SsoSettings } from '@/components/settings/sso-settings'
import { requireWorkspacePageAuth } from '@/lib/workspace-page-auth'

export const metadata: Metadata = {
  title: 'SSO — Settings',
  description: 'Configure single sign-on for your workspace.',
}

export default async function SsoSettingsPage() {
  const ctx = await requireWorkspacePageAuth('admin')

  return <SsoSettings workspaceId={ctx.workspaceId} />
}
