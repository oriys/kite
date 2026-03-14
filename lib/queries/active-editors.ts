import { eq, and, lt } from 'drizzle-orm'
import { db } from '../db'
import { activeEditors, users } from '../schema'

const PRESENCE_TIMEOUT_MS = 30_000

export async function upsertPresence(
  documentId: string,
  userId: string,
  cursorPosition?: number,
) {
  const [editor] = await db
    .insert(activeEditors)
    .values({
      documentId,
      userId,
      cursorPosition: cursorPosition ?? null,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [activeEditors.documentId, activeEditors.userId],
      set: {
        cursorPosition: cursorPosition ?? null,
        lastSeenAt: new Date(),
      },
    })
    .returning()
  return editor
}

export async function removePresence(documentId: string, userId: string) {
  await db
    .delete(activeEditors)
    .where(
      and(
        eq(activeEditors.documentId, documentId),
        eq(activeEditors.userId, userId),
      ),
    )
}

export async function clearPresenceForDocument(documentId: string) {
  await db.delete(activeEditors).where(eq(activeEditors.documentId, documentId))
}

export async function getActiveEditors(documentId: string) {
  const cutoff = new Date(Date.now() - PRESENCE_TIMEOUT_MS)

  // Clean up stale entries for this document only
  await db
    .delete(activeEditors)
    .where(and(eq(activeEditors.documentId, documentId), lt(activeEditors.lastSeenAt, cutoff)))

  return db
    .select({
      userId: activeEditors.userId,
      userName: users.name,
      userImage: users.image,
      cursorPosition: activeEditors.cursorPosition,
      lastSeenAt: activeEditors.lastSeenAt,
    })
    .from(activeEditors)
    .innerJoin(users, eq(activeEditors.userId, users.id))
    .where(eq(activeEditors.documentId, documentId))
}
