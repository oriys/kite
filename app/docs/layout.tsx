import type { Metadata } from 'next'

import { DocsTopNav } from '@/components/docs/docs-top-nav'
import { PersonalSettingsProvider } from '@/components/personal-settings-provider'
import { getAuthenticatedUser } from '@/lib/api-utils'
import { createDefaultPersonalFeatureVisibility, mergeNavOrder } from '@/lib/personal-settings'
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
  const data = user?.id
    ? await getUserFeatureVisibility(user.id)
    : null
  const { navOrder: initialNavOrder, ...initialFeatureVisibility } = data ?? {
    ...createDefaultPersonalFeatureVisibility(),
    navOrder: mergeNavOrder(),
  }

  return (
    <PersonalSettingsProvider
      initialFeatureVisibility={initialFeatureVisibility}
      initialNavOrder={initialNavOrder}
    >
      <div className="flex h-dvh flex-col bg-background">
        <DocsTopNav />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </PersonalSettingsProvider>
  )
}
