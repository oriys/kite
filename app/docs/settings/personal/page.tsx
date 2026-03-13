import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PersonalSettingsPage } from '@/components/settings/personal-settings-page'
import { getAuthenticatedUser, getWorkspaceContext } from '@/lib/api-utils'
import { getNotificationPreferences } from '@/lib/queries/notifications'

export const metadata: Metadata = {
  title: 'Personal Settings — Kite',
  description:
    'Adjust your theme, editor defaults, notifications, and feature visibility.',
}

export default async function PersonalSettingsRoute() {
  const user = await getAuthenticatedUser()
  if (!user?.id) {
    redirect('/auth/signin')
  }

  const workspace = await getWorkspaceContext(user.id)
  if (!workspace) {
    redirect('/docs')
  }

  const initialNotificationPreferences = await getNotificationPreferences(
    user.id,
    workspace.id,
  )

  return (
    <PersonalSettingsPage
      initialNotificationPreferences={initialNotificationPreferences}
      workspaceName={workspace.name}
    />
  )
}
