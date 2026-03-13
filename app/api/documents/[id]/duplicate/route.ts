import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  withWorkspaceAuth,
  notFound,
  forbidden,
} from '@/lib/api-utils'
import { duplicateDocument, getDocument } from '@/lib/queries/documents'
import {
  attachDocumentAccess,
  buildDocumentAccessMap,
} from '@/lib/queries/document-permissions'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await context.params
  const existing = await getDocument(id, result.ctx.workspaceId)
  if (!existing) return notFound()

  const access = (
    await buildDocumentAccessMap([existing], result.ctx.userId, result.ctx.role)
  ).get(existing.id)
  if (!access?.canDuplicate) return forbidden()

  const doc = await duplicateDocument(id, result.ctx.workspaceId, result.ctx.userId)
  if (!doc) return notFound()

  const newDocAccess = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)

  return NextResponse.json(
    attachDocumentAccess(doc, newDocAccess!),
    { status: 201 },
  )
}
