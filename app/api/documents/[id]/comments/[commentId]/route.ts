import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import {
  deleteComment,
  resolveThread,
  unresolveThread,
} from '@/lib/queries/inline-comments'

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { commentId } = await context.params
  const deleted = await deleteComment(commentId)
  if (!deleted) return notFound()

  return NextResponse.json({ ok: true })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { commentId } = await context.params
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  if (body.action === 'resolve') {
    await resolveThread(commentId, result.ctx.userId)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'unresolve') {
    await unresolveThread(commentId)
    return NextResponse.json({ ok: true })
  }

  return badRequest('action must be "resolve" or "unresolve"')
}
