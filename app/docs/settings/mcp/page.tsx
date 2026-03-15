import type { Metadata } from 'next'

import { FeatureGuard } from '@/components/docs/feature-guard'
import { DocMcpManagerPage } from '@/components/docs/doc-mcp-manager-page'

export const metadata: Metadata = {
  title: 'MCP Servers — Settings',
  description: 'Connect external MCP servers for AI tool use.',
}

export default function McpSettingsPage() {
  return (
    <FeatureGuard featureId="aiWorkspace">
      <DocMcpManagerPage />
    </FeatureGuard>
  )
}
