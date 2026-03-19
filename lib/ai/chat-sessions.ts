import { eq, and, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { aiChatSessions, aiChatMessages } from '@/lib/schema'
import {
  type ChatSource,
  type ChatMessageAttribution,
  normalizeChatMessageAttribution,
} from '@/lib/ai-chat-shared'

export async function createChatSession(input: {
  workspaceId: string
  userId: string
  documentId?: string
  title?: string
}) {
  const [session] = await db
    .insert(aiChatSessions)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      documentId: input.documentId ?? null,
      title: input.title ?? 'New conversation',
    })
    .returning()

  return session
}

export async function listChatSessions(input: {
  workspaceId: string
  userId: string
  limit?: number
}) {
  return db
    .select({
      id: aiChatSessions.id,
      title: aiChatSessions.title,
      documentId: aiChatSessions.documentId,
      createdAt: aiChatSessions.createdAt,
      updatedAt: aiChatSessions.updatedAt,
    })
    .from(aiChatSessions)
    .where(
      and(
        eq(aiChatSessions.workspaceId, input.workspaceId),
        eq(aiChatSessions.userId, input.userId),
      ),
    )
    .orderBy(desc(aiChatSessions.updatedAt))
    .limit(input.limit ?? 20)
}

export async function getChatHistory(sessionId: string, workspaceId?: string) {
  const conditions = [eq(aiChatMessages.sessionId, sessionId)]
  if (workspaceId) {
    conditions.push(
      sql`${aiChatMessages.sessionId} IN (
        SELECT id FROM ai_chat_sessions WHERE id = ${sessionId} AND workspace_id = ${workspaceId}
      )` as ReturnType<typeof eq>,
    )
  }

  const rows = await db
    .select({
      id: aiChatMessages.id,
      role: aiChatMessages.role,
      content: aiChatMessages.content,
      sources: aiChatMessages.sources,
      attribution: aiChatMessages.attribution,
      createdAt: aiChatMessages.createdAt,
    })
    .from(aiChatMessages)
    .where(and(...conditions))
    .orderBy(aiChatMessages.createdAt)

  return rows.map((row) => ({
    ...row,
    attribution: normalizeChatMessageAttribution(row.attribution),
  }))
}

export async function saveChatMessage(input: {
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: ChatSource[]
  attribution?: ChatMessageAttribution
}) {
  const [message] = await db
    .insert(aiChatMessages)
    .values({
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      sources: input.sources ?? [],
      attribution: input.attribution,
    })
    .returning()

  // Update session timestamp
  await db
    .update(aiChatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(aiChatSessions.id, input.sessionId))

  return message
}
