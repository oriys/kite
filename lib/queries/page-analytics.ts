import { db } from '@/lib/db'
import { pageViews, documents } from '@/lib/schema'
import { eq, and, sql, desc, gte } from 'drizzle-orm'

export async function recordPageView(data: {
  workspaceId: string
  documentId?: string | null
  path: string
  referrer?: string | null
  userAgent?: string | null
  sessionId?: string | null
  userId?: string | null
  source?: string | null
}) {
  await db.insert(pageViews).values({
    workspaceId: data.workspaceId,
    documentId: data.documentId ?? null,
    path: data.path,
    referrer: data.referrer ?? null,
    userAgent: data.userAgent ?? null,
    sessionId: data.sessionId ?? null,
    userId: data.userId ?? null,
    source: data.source ?? 'internal',
  })
}

export async function getPageAnalyticsOverview(
  workspaceId: string,
  days = 30,
) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const previousStart = new Date()
  previousStart.setDate(previousStart.getDate() - days * 2)

  const [currentTotals] = await db
    .select({
      totalViews: sql<number>`count(*)::int`,
      uniqueVisitors: sql<number>`count(distinct ${pageViews.sessionId})::int`,
    })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.workspaceId, workspaceId),
        gte(pageViews.viewedAt, since),
      ),
    )

  const [previousTotals] = await db
    .select({
      totalViews: sql<number>`count(*)::int`,
      uniqueVisitors: sql<number>`count(distinct ${pageViews.sessionId})::int`,
    })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.workspaceId, workspaceId),
        gte(pageViews.viewedAt, previousStart),
        sql`${pageViews.viewedAt} < ${since}`,
      ),
    )

  const viewsByDay = await db
    .select({
      date: sql<string>`to_char(${pageViews.viewedAt}, 'YYYY-MM-DD')`,
      views: sql<number>`count(*)::int`,
      uniqueVisitors: sql<number>`count(distinct ${pageViews.sessionId})::int`,
    })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.workspaceId, workspaceId),
        gte(pageViews.viewedAt, since),
      ),
    )
    .groupBy(sql`to_char(${pageViews.viewedAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${pageViews.viewedAt}, 'YYYY-MM-DD')`)

  const topDocuments = await db
    .select({
      documentId: pageViews.documentId,
      title: documents.title,
      views: sql<number>`count(*)::int`,
      uniqueVisitors: sql<number>`count(distinct ${pageViews.sessionId})::int`,
      lastViewed: sql<string>`max(${pageViews.viewedAt})::text`,
    })
    .from(pageViews)
    .innerJoin(documents, eq(pageViews.documentId, documents.id))
    .where(
      and(
        eq(pageViews.workspaceId, workspaceId),
        gte(pageViews.viewedAt, since),
        sql`${pageViews.documentId} is not null`,
      ),
    )
    .groupBy(pageViews.documentId, documents.title)
    .orderBy(desc(sql`count(*)`))
    .limit(20)

  const totalViews = currentTotals?.totalViews ?? 0
  const uniqueVisitors = currentTotals?.uniqueVisitors ?? 0
  const prevViews = previousTotals?.totalViews ?? 0

  const viewsTrend =
    prevViews > 0 ? ((totalViews - prevViews) / prevViews) * 100 : 0

  const docCount = topDocuments.length
  const avgViewsPerDoc = docCount > 0 ? Math.round(totalViews / docCount) : 0

  let mostActiveDay = '—'
  if (viewsByDay.length > 0) {
    const max = viewsByDay.reduce((a, b) => (b.views > a.views ? b : a))
    mostActiveDay = max.date
  }

  return {
    totalViews,
    uniqueVisitors,
    viewsTrend,
    avgViewsPerDoc,
    mostActiveDay,
    viewsByDay,
    topDocuments,
  }
}

export async function getDocumentAnalytics(documentId: string, days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const [totals] = await db
    .select({
      totalViews: sql<number>`count(*)::int`,
      uniqueVisitors: sql<number>`count(distinct ${pageViews.sessionId})::int`,
    })
    .from(pageViews)
    .where(
      and(eq(pageViews.documentId, documentId), gte(pageViews.viewedAt, since)),
    )

  const viewsByDay = await db
    .select({
      date: sql<string>`to_char(${pageViews.viewedAt}, 'YYYY-MM-DD')`,
      views: sql<number>`count(*)::int`,
      uniqueVisitors: sql<number>`count(distinct ${pageViews.sessionId})::int`,
    })
    .from(pageViews)
    .where(
      and(eq(pageViews.documentId, documentId), gte(pageViews.viewedAt, since)),
    )
    .groupBy(sql`to_char(${pageViews.viewedAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${pageViews.viewedAt}, 'YYYY-MM-DD')`)

  const topReferrers = await db
    .select({
      referrer: pageViews.referrer,
      count: sql<number>`count(*)::int`,
    })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.documentId, documentId),
        gte(pageViews.viewedAt, since),
        sql`${pageViews.referrer} is not null`,
      ),
    )
    .groupBy(pageViews.referrer)
    .orderBy(desc(sql`count(*)`))
    .limit(10)

  return {
    totalViews: totals?.totalViews ?? 0,
    uniqueVisitors: totals?.uniqueVisitors ?? 0,
    viewsByDay,
    topReferrers,
  }
}
