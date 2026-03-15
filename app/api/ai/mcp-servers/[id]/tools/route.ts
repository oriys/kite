import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { notFound, withWorkspaceAuth } from '@/lib/api-utils'
import { getMcpServerConfig } from '@/lib/queries/mcp'
import { listMcpServerTools } from '@/lib/mcp-client'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const config = await getMcpServerConfig(id, result.ctx.workspaceId)
  if (!config) return notFound()

  try {
    const tools = await listMcpServerTools(config)
    return NextResponse.json({ tools })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to list tools'
    return NextResponse.json({ error: message, tools: [] }, { status: 502 })
  }
}
