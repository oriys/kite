import { db } from '@/lib/db'
import { linkChecks, documents } from '@/lib/schema'
import { eq, sql, desc, and, isNull } from 'drizzle-orm'

export async function getLinkChecksByWorkspace(workspaceId: string) {
  return db
    .select({
      id: linkChecks.id,
      url: linkChecks.url,
      statusCode: linkChecks.statusCode,
      isAlive: linkChecks.isAlive,
      errorMessage: linkChecks.errorMessage,
      lastCheckedAt: linkChecks.lastCheckedAt,
      documentId: linkChecks.documentId,
      documentTitle: documents.title,
    })
    .from(linkChecks)
    .leftJoin(documents, eq(linkChecks.documentId, documents.id))
    .where(
      and(
        eq(linkChecks.workspaceId, workspaceId),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(linkChecks.isAlive, desc(linkChecks.lastCheckedAt))
}

export async function getLinkChecksByDocument(documentId: string) {
  return db
    .select()
    .from(linkChecks)
    .where(eq(linkChecks.documentId, documentId))
    .orderBy(linkChecks.isAlive, desc(linkChecks.lastCheckedAt))
}

export async function upsertLinkCheck(data: {
  workspaceId: string
  documentId: string
  url: string
  statusCode: number | null
  isAlive: boolean
  errorMessage: string | null
}) {
  await db
    .insert(linkChecks)
    .values(data)
    .onConflictDoUpdate({
      target: [linkChecks.documentId, linkChecks.url],
      set: {
        statusCode: sql`excluded.status_code`,
        isAlive: sql`excluded.is_alive`,
        errorMessage: sql`excluded.error_message`,
        lastCheckedAt: sql`now()`,
      },
    })
}

export async function getLinkHealthSummary(workspaceId: string) {
  const [result] = await db
    .select({
      totalLinks: sql<number>`count(*)::int`,
      aliveLinks: sql<number>`count(*) filter (where ${linkChecks.isAlive} = true)::int`,
      deadLinks: sql<number>`count(*) filter (where ${linkChecks.isAlive} = false)::int`,
      lastCheckedAt: sql<Date | null>`max(${linkChecks.lastCheckedAt})`,
    })
    .from(linkChecks)
    .where(eq(linkChecks.workspaceId, workspaceId))

  return result ?? { totalLinks: 0, aliveLinks: 0, deadLinks: 0, lastCheckedAt: null }
}
