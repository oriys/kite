import { db } from './db'
import { scheduledPublications, documents } from './schema'
import { eq, and, lte, isNull } from 'drizzle-orm'
import { transitionDocument } from './queries/documents'

export async function processScheduledPublications() {
  const now = new Date()

  const pending = await db
    .select({
      id: scheduledPublications.id,
      documentId: scheduledPublications.documentId,
      workspaceId: scheduledPublications.workspaceId,
      createdBy: scheduledPublications.createdBy,
    })
    .from(scheduledPublications)
    .where(
      and(
        eq(scheduledPublications.status, 'pending'),
        lte(scheduledPublications.scheduledAt, now),
      ),
    )
    .limit(50)

  const results: { id: string; success: boolean; error?: string }[] = []

  for (const item of pending) {
    try {
      // Verify document is still in a publishable state
      const [doc] = await db
        .select({ status: documents.status })
        .from(documents)
        .where(
          and(
            eq(documents.id, item.documentId),
            eq(documents.workspaceId, item.workspaceId),
            isNull(documents.deletedAt),
          ),
        )
        .limit(1)

      if (!doc || (doc.status !== 'review' && doc.status !== 'draft')) {
        await db
          .update(scheduledPublications)
          .set({ status: 'skipped', updatedAt: new Date() })
          .where(eq(scheduledPublications.id, item.id))

        results.push({ id: item.id, success: false, error: 'Document not in publishable state' })
        continue
      }

      await transitionDocument(
        item.documentId,
        item.workspaceId,
        'published',
        item.createdBy ?? undefined,
      )

      await db
        .update(scheduledPublications)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(scheduledPublications.id, item.id))

      results.push({ id: item.id, success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await db
        .update(scheduledPublications)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(scheduledPublications.id, item.id))

      results.push({ id: item.id, success: false, error: message })
    }
  }

  return results
}
