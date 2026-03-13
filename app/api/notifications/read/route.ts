import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { markNotificationRead } from '@/lib/queries/notifications'

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body?.id || typeof body.id !== 'string')
    return badRequest('Notification id is required')

  const n = await markNotificationRead(body.id, result.ctx.userId)
  if (!n) return badRequest('Notification not found')

  return NextResponse.json(n)
}
