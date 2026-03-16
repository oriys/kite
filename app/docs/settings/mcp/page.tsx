import type { Metadata } from 'next'

import { FeatureGuard } from '@/components/docs/feature-guard'
import { DocMcpManagerPage } from '@/components/docs/doc-mcp-manager-page'
import { requireWorkspacePageAuth } from '@/lib/workspace-page-auth'

export const metadata: Metadata = {
  title: 'MCP Servers — Settings',
  description: 'Connect external MCP servers for AI tool use.',
}

export default async function McpSettingsPage() {
  await requireWorkspacePageAuth('admin')

  return (
    <FeatureGuard featureId="aiWorkspace">
      <DocMcpManagerPage />
    </FeatureGuard>
  )
}
