import type { Metadata } from 'next'

import { SettingsSidebar } from '@/components/settings/settings-sidebar'
import { SettingsAccessProvider } from '@/components/settings/settings-access-provider'
import { requireWorkspacePageAuth } from '@/lib/workspace-page-auth'

export const metadata: Metadata = {
  title: 'Settings — Kite',
  description: 'Manage personal preferences and workspace administration.',
}

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await requireWorkspacePageAuth('guest')

  return (
    <SettingsAccessProvider currentRole={ctx.role} workspaceId={ctx.workspaceId}>
      <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-8 sm:px-6">
        <SettingsSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </SettingsAccessProvider>
  )
}
