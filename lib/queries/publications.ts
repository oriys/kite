import { desc, eq, and, sql } from 'drizzle-orm'
import { db } from '../db'
import { publishedSnapshots } from '../schema'

export async function listPublicationHistory(
  documentId: string,
  workspaceId: string,
  limit = 20,
  offset = 0,
) {
  return db
    .select({
      id: publishedSnapshots.id,
      version: publishedSnapshots.version,
      title: publishedSnapshots.title,
      publishedAt: publishedSnapshots.publishedAt,
      publishedBy: publishedSnapshots.publishedBy,
      isActive: publishedSnapshots.isActive,
      rollbackOf: publishedSnapshots.rollbackOf,
    })
    .from(publishedSnapshots)
    .where(
      and(
        eq(publishedSnapshots.documentId, documentId),
        eq(publishedSnapshots.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(publishedSnapshots.version))
    .limit(limit)
    .offset(offset)
}

export async function getPublicationSnapshot(
  documentId: string,
  workspaceId: string,
  version: number,
) {
  return (await db.query.publishedSnapshots.findFirst({
    where: and(
      eq(publishedSnapshots.documentId, documentId),
      eq(publishedSnapshots.workspaceId, workspaceId),
      eq(publishedSnapshots.version, version),
    ),
  })) ?? null
}

export async function rollbackToSnapshot(
  documentId: string,
  workspaceId: string,
  targetVersion: number,
  actorId: string,
) {
  const target = await getPublicationSnapshot(documentId, workspaceId, targetVersion)
  if (!target) return null

  return db.transaction(async (tx) => {
    // Deactivate current active
    await tx
      .update(publishedSnapshots)
      .set({ isActive: false })
      .where(
        and(
          eq(publishedSnapshots.documentId, documentId),
          eq(publishedSnapshots.workspaceId, workspaceId),
          eq(publishedSnapshots.isActive, true),
        ),
      )

    // Get next version number
    const [maxVersion] = await tx
      .select({ max: sql<number>`coalesce(max(${publishedSnapshots.version}), 0)` })
      .from(publishedSnapshots)
      .where(
        and(
          eq(publishedSnapshots.documentId, documentId),
          eq(publishedSnapshots.workspaceId, workspaceId),
        ),
      )

    // Create new snapshot as rollback
    const [snapshot] = await tx
      .insert(publishedSnapshots)
      .values({
        workspaceId,
        documentId,
        version: (maxVersion?.max ?? 0) + 1,
        title: target.title,
        slug: target.slug,
        publishedSlug: target.publishedSlug,
        content: target.content,
        summary: target.summary,
        category: target.category,
        tags: target.tags,
        locale: target.locale,
        navSection: target.navSection,
        publishOrder: target.publishOrder,
        visibility: target.visibility,
        publishedBy: actorId,
        isActive: true,
        rollbackOf: targetVersion,
      })
      .returning()

    return snapshot
  })
}
