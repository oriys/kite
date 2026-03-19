import { db } from './db'
import { scheduledPublications, documents } from './schema'
import { eq, and, lte, isNull, inArray } from 'drizzle-orm'
import { transitionDocument } from './queries/documents'
import { getApprovedApprovalForDocument } from './queries/approvals'

export async function processScheduledPublications() {
  const now = new Date()

  // Atomically claim pending rows to prevent double-publish from concurrent workers
  const claimed = await db
    .update(scheduledPublications)
    .set({ status: 'processing', updatedAt: now })
    .where(
      and(
        eq(scheduledPublications.status, 'pending'),
        lte(scheduledPublications.scheduledAt, now),
      ),
    )
    .returning({
      id: scheduledPublications.id,
      documentId: scheduledPublications.documentId,
      workspaceId: scheduledPublications.workspaceId,
      createdBy: scheduledPublications.createdBy,
    })

  if (claimed.length === 0) return []

  // Batch-load document states to avoid N+1
  const documentIds = [...new Set(claimed.map((c) => c.documentId))]
  const docRows = await db
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .where(
      and(
        inArray(documents.id, documentIds),
        isNull(documents.deletedAt),
      ),
    )
  const docMap = new Map(docRows.map((d) => [d.id, d]))

  const results: { id: string; success: boolean; error?: string }[] = []

  for (const item of claimed) {
    try {
      const doc = docMap.get(item.documentId)

      if (!doc || doc.status !== 'review') {
        await db
          .update(scheduledPublications)
          .set({ status: 'skipped', updatedAt: new Date() })
          .where(eq(scheduledPublications.id, item.id))

        results.push({ id: item.id, success: false, error: 'Document not in publishable state' })
        continue
      }

      // Verify approval has been granted before publishing
      const approved = await getApprovedApprovalForDocument(item.documentId, item.workspaceId)
      if (!approved) {
        await db
          .update(scheduledPublications)
          .set({ status: 'skipped', updatedAt: new Date() })
          .where(eq(scheduledPublications.id, item.id))

        results.push({ id: item.id, success: false, error: 'No approved approval request' })
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
