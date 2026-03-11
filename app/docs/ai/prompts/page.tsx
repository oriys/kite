import type { Metadata } from 'next'

import { DocAiPromptManagerPage } from '@/components/docs/doc-ai-prompt-manager-page'

export const metadata: Metadata = {
  title: 'AI Prompt Studio — Editorial System',
  description: 'Manage the AI prompts used by editor actions on this browser.',
}

export default function DocAiPromptsPage() {
  return <DocAiPromptManagerPage />
}
