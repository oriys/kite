import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { searchLogs } from '@/lib/schema'

export async function logSearch(data: {
  workspaceId: string
  userId?: string
  query: string
  resultCount: number
}): Promise<void> {
  await db.insert(searchLogs).values({
    workspaceId: data.workspaceId,
    userId: data.userId ?? null,
    query: data.query,
    resultCount: data.resultCount,
  })
}

export async function logSearchClick(
  searchLogId: string,
  documentId: string,
): Promise<void> {
  await db
    .update(searchLogs)
    .set({ clickedDocumentId: documentId })
    .where(eq(searchLogs.id, searchLogId))
}

/**
 * Queries that returned zero results, ordered by frequency.
 */
export async function getZeroResultSearches(
  workspaceId: string,
  limit = 20,
) {
  const rows = await db
    .select({
      query: searchLogs.query,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(searchLogs)
    .where(
      and(
        eq(searchLogs.workspaceId, workspaceId),
        eq(searchLogs.resultCount, 0),
      ),
    )
    .groupBy(searchLogs.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)

  return rows
}

/**
 * Most popular search queries, ordered by frequency.
 */
export async function getPopularSearches(
  workspaceId: string,
  limit = 20,
) {
  const rows = await db
    .select({
      query: searchLogs.query,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(searchLogs)
    .where(eq(searchLogs.workspaceId, workspaceId))
    .groupBy(searchLogs.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)

  return rows
}
