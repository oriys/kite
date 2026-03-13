import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/queries/notifications'

export async function GET() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const prefs = await getNotificationPreferences(
    result.ctx.userId,
    result.ctx.workspaceId,
  )
  return NextResponse.json(prefs)
}

export async function PUT(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const allowed = [
    'commentEnabled',
    'mentionEnabled',
    'approvalEnabled',
    'statusChangeEnabled',
    'webhookFailureEnabled',
  ] as const

  const updates: Record<string, boolean> = {}
  for (const key of allowed) {
    if (typeof body[key] === 'boolean') updates[key] = body[key]
  }

  const prefs = await updateNotificationPreferences(
    result.ctx.userId,
    result.ctx.workspaceId,
    updates,
  )
  return NextResponse.json(prefs)
}
