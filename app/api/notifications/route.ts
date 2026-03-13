import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { listNotifications } from '@/lib/queries/notifications'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { searchParams } = request.nextUrl
  const unreadOnly = searchParams.get('unreadOnly') === 'true'
  const limit = Math.min(Number(searchParams.get('limit') ?? 30), 100)
  const offset = Number(searchParams.get('offset') ?? 0)

  const data = await listNotifications(
    result.ctx.userId,
    result.ctx.workspaceId,
    { limit, offset, unreadOnly },
  )

  return NextResponse.json(data)
}
