import type { Metadata } from 'next'

import { PersonalSettingsPage } from '@/components/settings/personal-settings-page'
import { requireWorkspacePageAuth } from '@/lib/workspace-page-auth'
import { getNotificationPreferences } from '@/lib/queries/notifications'

export const metadata: Metadata = {
  title: 'Personal Settings — Kite',
  description:
    'Adjust your theme, editor defaults, notifications, and feature visibility.',
}

export default async function PersonalSettingsRoute() {
  const ctx = await requireWorkspacePageAuth('guest')

  const initialNotificationPreferences = await getNotificationPreferences(
    ctx.userId,
    ctx.workspaceId,
  )

  return (
    <PersonalSettingsPage
      initialNotificationPreferences={initialNotificationPreferences}
      workspaceName={ctx.workspaceName}
    />
  )
}
