import { NextResponse } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { markAllNotificationsRead } from '@/lib/queries/notifications'

export async function POST() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  await markAllNotificationsRead(result.ctx.userId, result.ctx.workspaceId)
  return NextResponse.json({ success: true })
}
