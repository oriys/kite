import { NextResponse } from 'next/server'

import { withWorkspaceAuth } from '@/lib/api-utils'
import { resolveWorkspaceMcpPrompts } from '@/lib/mcp-prompts'

export async function GET() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  try {
    const prompts = await resolveWorkspaceMcpPrompts(result.ctx.workspaceId)
    return NextResponse.json({ prompts })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load MCP prompts'
    return NextResponse.json({ error: message, prompts: [] }, { status: 502 })
  }
}
