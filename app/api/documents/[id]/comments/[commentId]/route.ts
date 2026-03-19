import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  withWorkspaceAuth,
  badRequest,
  forbidden,
  notFound,
} from '@/lib/api-utils'
import {
  deleteComment,
  resolveThread,
  unresolveThread,
} from '@/lib/queries/inline-comments'
import { getDocument } from '@/lib/queries/documents'
import { buildDocumentAccessMap } from '@/lib/queries/document-permissions'

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id, commentId } = await context.params
  const document = await getDocument(id, result.ctx.workspaceId)
  if (!document) return notFound()

  const access = (
    await buildDocumentAccessMap([document], result.ctx.userId, result.ctx.role)
  ).get(document.id)
  if (!access?.canEdit) return forbidden()

  const deleted = await deleteComment(commentId, id)
  if (!deleted) return notFound()

  return NextResponse.json({ ok: true })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id, commentId } = await context.params
  const document = await getDocument(id, result.ctx.workspaceId)
  if (!document) return notFound()

  const access = (
    await buildDocumentAccessMap([document], result.ctx.userId, result.ctx.role)
  ).get(document.id)
  if (!access?.canView) return forbidden()

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  if (body.action === 'resolve') {
    await resolveThread(commentId, result.ctx.userId, id)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'unresolve') {
    await unresolveThread(commentId, id)
    return NextResponse.json({ ok: true })
  }

  return badRequest('action must be "resolve" or "unresolve"')
}
