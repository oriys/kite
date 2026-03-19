import { NextResponse } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import {
  getBrokenLinkChecksByDocuments,
  getLinkHealthSummaryByDocuments,
} from '@/lib/queries/link-checks'
import { checkDocumentLinks } from '@/lib/link-checker'
import { db } from '@/lib/db'
import { documents } from '@/lib/schema'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { buildDocumentAccessMap } from '@/lib/queries/document-permissions'

export async function GET() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const workspaceDocs = await db
    .select({
      id: documents.id,
      visibility: documents.visibility,
      createdBy: documents.createdBy,
    })
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, result.ctx.workspaceId),
        isNull(documents.deletedAt),
      ),
    )

  const accessMap = await buildDocumentAccessMap(
    workspaceDocs,
    result.ctx.userId,
    result.ctx.role,
  )
  const visibleDocumentIds = workspaceDocs
    .filter((doc) => accessMap.get(doc.id)?.canView)
    .map((doc) => doc.id)

  const [checks, summary] = await Promise.all([
    getBrokenLinkChecksByDocuments(result.ctx.workspaceId, visibleDocumentIds),
    getLinkHealthSummaryByDocuments(result.ctx.workspaceId, visibleDocumentIds),
  ])

  return NextResponse.json({
    checks,
    summary,
  })
}

export async function POST() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const publishedDocs = await db
    .select({
      id: documents.id,
      visibility: documents.visibility,
      createdBy: documents.createdBy,
    })
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, result.ctx.workspaceId),
        eq(documents.status, 'published'),
        isNull(documents.deletedAt),
      ),
    )

  const accessMap = await buildDocumentAccessMap(
    publishedDocs,
    result.ctx.userId,
    result.ctx.role,
  )
  const editableDocs = publishedDocs.filter(
    (doc) => accessMap.get(doc.id)?.canEdit,
  )
  const editableDocIds = editableDocs.map((doc) => doc.id)

  const editableDocContents = editableDocIds.length
    ? await db
        .select({
          id: documents.id,
          content: documents.content,
        })
        .from(documents)
        .where(
          and(
            eq(documents.workspaceId, result.ctx.workspaceId),
            isNull(documents.deletedAt),
            inArray(documents.id, editableDocIds),
          ),
        )
    : []
  const contentByDocumentId = new Map(
    editableDocContents.map((doc) => [doc.id, doc.content]),
  )

  let totalLinks = 0
  let deadLinks = 0

  for (const doc of editableDocs) {
    const content = contentByDocumentId.get(doc.id) ?? ''
    const results = await checkDocumentLinks(doc.id, result.ctx.workspaceId, content)
    totalLinks += results.length
    deadLinks += results.filter((r) => !r.isAlive).length
  }

  const visibleDocumentIds = publishedDocs
    .filter((doc) => accessMap.get(doc.id)?.canView)
    .map((doc) => doc.id)
  const summary = await getLinkHealthSummaryByDocuments(result.ctx.workspaceId, visibleDocumentIds)

  return NextResponse.json({
    scannedDocuments: editableDocs.length,
    totalLinks,
    deadLinks,
    summary,
  })
}
