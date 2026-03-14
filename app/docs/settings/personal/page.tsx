import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PersonalSettingsPage } from '@/components/settings/personal-settings-page'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { getNotificationPreferences } from '@/lib/queries/notifications'

export const metadata: Metadata = {
  title: 'Personal Settings — Kite',
  description:
    'Adjust your theme, editor defaults, notifications, and feature visibility.',
}

export default async function PersonalSettingsRoute() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) {
    if (result.error.status === 401) {
      redirect('/auth/signin')
    }

    redirect('/docs')
  }

  const initialNotificationPreferences = await getNotificationPreferences(
    result.ctx.userId,
    result.ctx.workspaceId,
  )

  return (
    <PersonalSettingsPage
      initialNotificationPreferences={initialNotificationPreferences}
      workspaceName={result.ctx.workspaceName}
    />
  )
}
