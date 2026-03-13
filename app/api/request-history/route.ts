import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import {
  listRequestHistory,
  clearRequestHistory,
} from '@/lib/queries/api-environments'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 50), 100)
  const offset = Number(request.nextUrl.searchParams.get('offset') ?? 0)

  const items = await listRequestHistory(result.ctx.workspaceId, {
    userId: result.ctx.userId,
    limit,
    offset,
  })

  return NextResponse.json(items)
}

export async function DELETE() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  await clearRequestHistory(result.ctx.workspaceId)
  return NextResponse.json({ success: true })
}
