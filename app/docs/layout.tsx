import type { Metadata } from 'next'

import { DocsTopNav } from '@/components/docs/docs-top-nav'
import { AiChatTrigger } from '@/components/ai-chat-panel'
import { PersonalSettingsProvider } from '@/components/personal-settings-provider'
import { getAuthenticatedUser } from '@/lib/api-utils'
import { createDefaultPersonalFeatureVisibility } from '@/lib/personal-settings'
import { getUserFeatureVisibility } from '@/lib/queries/personal-settings'

export const metadata: Metadata = {
  title: 'Documents — Kite',
  description: 'Create, edit, review, and publish documents.',
}

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthenticatedUser()
  const initialFeatureVisibility = user?.id
    ? await getUserFeatureVisibility(user.id)
    : createDefaultPersonalFeatureVisibility()

  return (
    <PersonalSettingsProvider initialFeatureVisibility={initialFeatureVisibility}>
      <div className="flex h-dvh flex-col bg-background">
        <DocsTopNav />
        <main className="flex-1 overflow-auto">{children}</main>
        <AiChatTrigger />
      </div>
    </PersonalSettingsProvider>
  )
}
