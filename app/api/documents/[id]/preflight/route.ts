import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { runPublishPreflight } from '@/lib/publish-preflight'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const preflight = await runPublishPreflight(id, result.ctx.workspaceId)

  return NextResponse.json(preflight)
}
