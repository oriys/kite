import { NextResponse } from 'next/server'

import { listChatSessions } from '@/lib/ai-chat'
import { withWorkspaceAuth } from '@/lib/api-utils'

export async function GET() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const sessions = await listChatSessions({
    workspaceId: result.ctx.workspaceId,
    userId: result.ctx.userId,
    limit: 30,
  })

  return NextResponse.json({ sessions })
}
