import { NextResponse } from 'next/server'
import {
  withWorkspaceAuth,
  forbidden,
  notFound,
} from '@/lib/api-utils'
import { getLinkChecksByDocument } from '@/lib/queries/link-checks'
import { checkDocumentLinks } from '@/lib/link-checker'
import { getDocument } from '@/lib/queries/documents'
import { buildDocumentAccessMap } from '@/lib/queries/document-permissions'

interface RouteContext {
  params: Promise<{ documentId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { documentId } = await context.params
  const document = await getDocument(documentId, result.ctx.workspaceId)
  if (!document) return notFound()

  const access = (
    await buildDocumentAccessMap([document], result.ctx.userId, result.ctx.role)
  ).get(document.id)
  if (!access?.canView) return forbidden()

  const checks = await getLinkChecksByDocument(documentId)
  return NextResponse.json(checks)
}

export async function POST(_request: Request, context: RouteContext) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { documentId } = await context.params
  const doc = await getDocument(documentId, result.ctx.workspaceId)

  if (!doc) return notFound()

  const access = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)
  if (!access?.canEdit) return forbidden()

  const checks = await checkDocumentLinks(doc.id, result.ctx.workspaceId, doc.content)
  return NextResponse.json({
    totalLinks: checks.length,
    deadLinks: checks.filter((c) => !c.isAlive).length,
    checks,
  })
}
