import { NextResponse } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { approvalRequests, documents } from '@/lib/schema'
import { eq, and, lte, sql, desc } from 'drizzle-orm'

export async function GET() {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

  const stale = await db
    .select({
      id: approvalRequests.id,
      title: approvalRequests.title,
      documentId: approvalRequests.documentId,
      documentTitle: documents.title,
      requesterId: approvalRequests.requesterId,
      deadline: approvalRequests.deadline,
      createdAt: approvalRequests.createdAt,
      age: sql<number>`extract(epoch from now() - ${approvalRequests.createdAt})::int`,
    })
    .from(approvalRequests)
    .innerJoin(documents, eq(documents.id, approvalRequests.documentId))
    .where(
      and(
        eq(approvalRequests.workspaceId, result.ctx.workspaceId),
        eq(approvalRequests.status, 'pending'),
        lte(approvalRequests.createdAt, threeDaysAgo),
      ),
    )
    .orderBy(desc(sql`age`))
    .limit(50)

  return NextResponse.json({
    items: stale,
    total: stale.length,
  })
}
