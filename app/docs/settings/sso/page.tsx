import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { SsoSettings } from '@/components/settings/sso-settings'

export const metadata: Metadata = {
  title: 'SSO — Settings',
  description: 'Configure single sign-on for your workspace.',
}

export default async function SsoSettingsPage() {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) redirect('/auth/signin')

  return <SsoSettings workspaceId={result.ctx.workspaceId} />
}
