import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { listPublicationHistory } from '@/lib/queries/publications'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const { searchParams } = request.nextUrl
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100)
  const offset = Number(searchParams.get('offset') ?? 0)

  const history = await listPublicationHistory(id, result.ctx.workspaceId, limit, offset)
  return NextResponse.json(history)
}
