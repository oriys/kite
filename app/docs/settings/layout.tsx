import type { Metadata } from 'next'
import { SettingsSidebar } from '@/components/settings/settings-sidebar'

export const metadata: Metadata = {
  title: 'Settings — Kite',
  description: 'Manage workspace members, teams, and settings.',
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-8">
      <SettingsSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
