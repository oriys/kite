import type { Metadata } from 'next'

import { DocSnippetManagerPage } from '@/components/docs/doc-snippet-manager-page'

export const metadata: Metadata = {
  title: 'Quick Insert — Settings',
  description: 'Manage quick insert components for the document editor.',
}

export default function QuickInsertSettingsPage() {
  return <DocSnippetManagerPage />
}
