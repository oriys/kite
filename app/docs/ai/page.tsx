import type { Metadata } from 'next'

import { DocAiManagerPage } from '@/components/docs/doc-ai-manager-page'

export const metadata: Metadata = {
  title: 'AI Control Center — Editorial System',
  description: 'Manage which AI models are enabled inside the editor.',
}

export default function DocAiPage() {
  return <DocAiManagerPage />
}
