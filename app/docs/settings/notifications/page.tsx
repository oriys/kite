import type { Metadata } from 'next'

import { NotificationChannelsSettings } from '@/components/settings/notification-channels-settings'
import { requireWorkspacePageAuth } from '@/lib/workspace-page-auth'

export const metadata: Metadata = {
  title: 'Notification Channels — Kite',
  description:
    'Configure email and Slack channels for workspace notifications.',
}

export default async function NotificationChannelsRoute() {
  const ctx = await requireWorkspacePageAuth('admin')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Notification channels
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Route workspace notifications to email inboxes and Slack channels so
          your team stays informed without checking Kite directly.
        </p>
      </div>

      <NotificationChannelsSettings
        workspaceId={ctx.workspaceId}
      />
    </div>
  )
}
