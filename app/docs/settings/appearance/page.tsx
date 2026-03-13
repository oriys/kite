import type { Metadata } from 'next'

import { AppearanceSettingsPage } from '@/components/settings/appearance-settings-page'

export const metadata: Metadata = {
  title: 'Appearance — Kite',
  description:
    'Customize colors, fonts, contrast, and interface behavior for light and dark mode.',
}

export default function AppearanceSettingsRoute() {
  return <AppearanceSettingsPage />
}
