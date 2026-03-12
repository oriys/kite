import { NextResponse } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { getLinkChecksByWorkspace, getLinkHealthSummary } from '@/lib/queries/link-checks'
import { checkDocumentLinks } from '@/lib/link-checker'
import { db } from '@/lib/db'
import { documents } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const [checks, summary] = await Promise.all([
    getLinkChecksByWorkspace(result.ctx.workspaceId),
    getLinkHealthSummary(result.ctx.workspaceId),
  ])

  return NextResponse.json({ checks, summary })
}

export async function POST() {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const publishedDocs = await db
    .select({ id: documents.id, content: documents.content })
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, result.ctx.workspaceId),
        eq(documents.status, 'published'),
      ),
    )

  let totalLinks = 0
  let deadLinks = 0

  for (const doc of publishedDocs) {
    const results = await checkDocumentLinks(doc.id, result.ctx.workspaceId, doc.content)
    totalLinks += results.length
    deadLinks += results.filter((r) => !r.isAlive).length
  }

  const summary = await getLinkHealthSummary(result.ctx.workspaceId)
  return NextResponse.json({
    scannedDocuments: publishedDocs.length,
    totalLinks,
    deadLinks,
    summary,
  })
}
