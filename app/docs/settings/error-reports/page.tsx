import type { Metadata } from 'next'

import { DocErrorReportsPage } from '@/components/docs/doc-error-reports-page'
import { requireWorkspacePageAuth } from '@/lib/workspace-page-auth'

export const metadata: Metadata = {
  title: 'Error Reports — Kite',
  description: 'Inspect workspace-scoped client and server failures.',
}

export default async function ErrorReportsSettingsPage() {
  await requireWorkspacePageAuth('admin')

  return <DocErrorReportsPage />
}
