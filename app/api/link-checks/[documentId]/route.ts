import { NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { getLinkChecksByDocument } from '@/lib/queries/link-checks'
import { checkDocumentLinks } from '@/lib/link-checker'
import { db } from '@/lib/db'
import { documents } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

interface RouteContext {
  params: Promise<{ documentId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { documentId } = await context.params
  const checks = await getLinkChecksByDocument(documentId)
  return NextResponse.json(checks)
}

export async function POST(_request: Request, context: RouteContext) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const { documentId } = await context.params

  const doc = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, documentId),
      eq(documents.workspaceId, result.ctx.workspaceId),
    ),
  })

  if (!doc) return notFound()

  const checks = await checkDocumentLinks(doc.id, result.ctx.workspaceId, doc.content)
  return NextResponse.json({
    totalLinks: checks.length,
    deadLinks: checks.filter((c) => !c.isAlive).length,
    checks,
  })
}
