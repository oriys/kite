import { NextResponse } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { documents, documentTranslations } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'

export async function GET() {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const rows = await db
    .select({
      documentId: documentTranslations.documentId,
      documentTitle: documents.title,
      locale: documentTranslations.locale,
      status: documentTranslations.status,
      updatedAt: documentTranslations.updatedAt,
    })
    .from(documentTranslations)
    .innerJoin(
      documents,
      and(
        eq(documents.id, documentTranslations.documentId),
        eq(documents.workspaceId, result.ctx.workspaceId),
        isNull(documents.deletedAt),
      ),
    )
    .where(isNull(documentTranslations.deletedAt))

  const totalTranslations = rows.length
  const published = rows.filter((r) => r.status === 'published').length
  const inProgress = rows.filter((r) => r.status === 'in_progress' || r.status === 'draft').length
  const needsReview = rows.filter((r) => r.status === 'review').length
  const outdated = rows.filter((r) => r.status === 'outdated').length

  return NextResponse.json({
    summary: {
      total: totalTranslations,
      published,
      inProgress,
      needsReview,
      outdated,
      completionRate: totalTranslations > 0 ? Math.round((published / totalTranslations) * 100) : 100,
    },
    items: rows,
  })
}
