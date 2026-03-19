import { db } from '@/lib/db'
import { linkChecks, documents } from '@/lib/schema'
import { eq, sql, desc, and, isNull, inArray } from 'drizzle-orm'

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

export async function getLinkChecksByDocument(workspaceId: string, documentId: string) {
  return db
    .select({
      id: linkChecks.id,
      url: linkChecks.url,
      statusCode: linkChecks.statusCode,
      isAlive: linkChecks.isAlive,
      errorMessage: linkChecks.errorMessage,
      lastCheckedAt: linkChecks.lastCheckedAt,
      documentId: linkChecks.documentId,
    })
    .from(linkChecks)
    .where(and(eq(linkChecks.documentId, documentId), eq(linkChecks.workspaceId, workspaceId)))
    .orderBy(linkChecks.isAlive, desc(linkChecks.lastCheckedAt))
}

export async function getBrokenLinkChecksByDocuments(workspaceId: string, documentIds: string[]) {
  if (documentIds.length === 0) return []

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
        inArray(linkChecks.documentId, documentIds),
        eq(linkChecks.workspaceId, workspaceId),
        eq(linkChecks.isAlive, false),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(desc(linkChecks.lastCheckedAt))
}

export async function getLinkHealthSummaryByDocuments(workspaceId: string, documentIds: string[]) {
  if (documentIds.length === 0) {
    return { totalLinks: 0, aliveLinks: 0, deadLinks: 0, lastCheckedAt: null }
  }

  const [result] = await db
    .select({
      totalLinks: sql<number>`count(*)::int`,
      aliveLinks: sql<number>`count(*) filter (where ${linkChecks.isAlive} = true)::int`,
      deadLinks: sql<number>`count(*) filter (where ${linkChecks.isAlive} = false)::int`,
      lastCheckedAt: sql<Date | null>`max(${linkChecks.lastCheckedAt})`,
    })
    .from(linkChecks)
    .where(and(inArray(linkChecks.documentId, documentIds), eq(linkChecks.workspaceId, workspaceId)))

  return result ?? { totalLinks: 0, aliveLinks: 0, deadLinks: 0, lastCheckedAt: null }
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
