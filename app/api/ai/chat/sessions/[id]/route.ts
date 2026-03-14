import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getChatHistory } from '@/lib/ai-chat'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { aiChatSessions } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params

  // Verify session belongs to this workspace and user
  const session = await db.query.aiChatSessions.findFirst({
    where: and(
      eq(aiChatSessions.id, id),
      eq(aiChatSessions.workspaceId, result.ctx.workspaceId),
      eq(aiChatSessions.userId, result.ctx.userId),
    ),
  })

  if (!session) return notFound()

  const messages = await getChatHistory(id)

  return NextResponse.json({
    session: {
      id: session.id,
      title: session.title,
      documentId: session.documentId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    messages,
  })
}
