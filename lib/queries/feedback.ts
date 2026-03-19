import { db } from '@/lib/db'
import { documentFeedback, documents, searchLogs } from '@/lib/schema'
import { eq, and, sql, desc, asc, isNull } from 'drizzle-orm'

/**
 * Submit document feedback. The documentFeedback table has no workspaceId column.
 * Callers must verify that the documentId belongs to the expected workspace
 * before calling this function.
 */
export async function submitFeedback(data: {
  documentId: string
  userId?: string
  isHelpful: boolean
  comment?: string
}) {
  const [row] = await db
    .insert(documentFeedback)
    .values({
      documentId: data.documentId,
      userId: data.userId ?? null,
      isHelpful: data.isHelpful,
      comment: data.comment ?? null,
    })
    .returning()

  return row
}

export async function getDocumentFeedbackSummary(workspaceId: string, documentId: string) {
  const [result] = await db
    .select({
      helpful: sql<number>`count(*) filter (where ${documentFeedback.isHelpful} = true)::int`,
      notHelpful: sql<number>`count(*) filter (where ${documentFeedback.isHelpful} = false)::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(documentFeedback)
    .innerJoin(documents, and(
      eq(documents.id, documentFeedback.documentId),
      eq(documents.workspaceId, workspaceId),
    ))
    .where(eq(documentFeedback.documentId, documentId))

  const helpful = result?.helpful ?? 0
  const total = result?.total ?? 0
  const ratio = total > 0 ? helpful / total : 0

  return { helpful, notHelpful: result?.notHelpful ?? 0, total, ratio }
}

export async function getWorkspaceFeedbackRanking(workspaceId: string, limit = 20) {
  const helpfulCount = sql<number>`
    count(*) filter (where ${documentFeedback.isHelpful} = true)::int
  `
  const notHelpfulCount = sql<number>`
    count(*) filter (where ${documentFeedback.isHelpful} = false)::int
  `
  const ratio = sql<number>`
    case when count(*) > 0
      then (count(*) filter (where ${documentFeedback.isHelpful} = true))::float / count(*)
      else 0
    end
  `

  return db
    .select({
      documentId: documentFeedback.documentId,
      title: documents.title,
      helpful: helpfulCount,
      notHelpful: notHelpfulCount,
      ratio,
    })
    .from(documentFeedback)
    .innerJoin(documents, eq(documentFeedback.documentId, documents.id))
    .where(and(eq(documents.workspaceId, workspaceId), isNull(documents.deletedAt)))
    .groupBy(documentFeedback.documentId, documents.title)
    .orderBy(asc(ratio))
    .limit(limit)
}

export async function getRecentFeedbackWithComments(workspaceId: string, limit = 20) {
  return db
    .select({
      id: documentFeedback.id,
      documentId: documentFeedback.documentId,
      documentTitle: documents.title,
      isHelpful: documentFeedback.isHelpful,
      comment: documentFeedback.comment,
      createdAt: documentFeedback.createdAt,
    })
    .from(documentFeedback)
    .innerJoin(documents, eq(documentFeedback.documentId, documents.id))
    .where(
      and(
        eq(documents.workspaceId, workspaceId),
        sql`${documentFeedback.comment} is not null`,
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(desc(documentFeedback.createdAt))
    .limit(limit)
}

export async function getZeroResultSearches(workspaceId: string, limit = 20) {
  return db
    .select({
      query: searchLogs.query,
      count: sql<number>`count(*)::int`,
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
}

export async function getPopularSearches(workspaceId: string, limit = 20) {
  return db
    .select({
      query: searchLogs.query,
      count: sql<number>`count(*)::int`,
    })
    .from(searchLogs)
    .where(eq(searchLogs.workspaceId, workspaceId))
    .groupBy(searchLogs.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)
}

export async function getSearchAnalytics(workspaceId: string) {
  const [totals] = await db
    .select({
      totalSearches: sql<number>`count(*)::int`,
      zeroResultCount: sql<number>`count(*) filter (where ${searchLogs.resultCount} = 0)::int`,
    })
    .from(searchLogs)
    .where(eq(searchLogs.workspaceId, workspaceId))

  const totalSearches = totals?.totalSearches ?? 0
  const zeroResultCount = totals?.zeroResultCount ?? 0
  const zeroResultRate = totalSearches > 0 ? zeroResultCount / totalSearches : 0

  const [topQueries, zeroResultQueries] = await Promise.all([
    getPopularSearches(workspaceId),
    getZeroResultSearches(workspaceId),
  ])

  return { totalSearches, zeroResultRate, topQueries, zeroResultQueries }
}
