import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { notFound, withWorkspaceAuth } from '@/lib/api-utils'
import { getMcpServerConfig } from '@/lib/queries/mcp'
import { testMcpServerConnection } from '@/lib/mcp-client'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const config = await getMcpServerConfig(id, result.ctx.workspaceId)
  if (!config) return notFound()

  try {
    const { ok, toolCount, promptCount, resourceCount, error } =
      await testMcpServerConnection(config)
    return NextResponse.json({
      ok,
      toolCount,
      promptCount,
      resourceCount,
      error,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Connection test failed'
    return NextResponse.json({
      ok: false,
      toolCount: 0,
      promptCount: 0,
      resourceCount: 0,
      error: message,
    })
  }
}
