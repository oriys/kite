import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound, badRequest } from '@/lib/api-utils'
import { getDocument, transitionDocument } from '@/lib/queries/documents'
import type { DocStatus } from '@/lib/documents'
import { isValidStatus, ALLOWED_TRANSITIONS } from '@/lib/constants'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body?.status || !isValidStatus(body.status)) {
    return badRequest('Invalid status')
  }

  const { id } = await context.params
  const existing = await getDocument(id, result.ctx.workspaceId)
  if (!existing) return notFound()

  const newStatus = body.status as DocStatus
  const allowed = ALLOWED_TRANSITIONS[existing.status as DocStatus]
  if (!allowed?.includes(newStatus)) {
    return badRequest(
      `Cannot transition from "${existing.status}" to "${newStatus}"`,
    )
  }

  const doc = await transitionDocument(id, result.ctx.workspaceId, newStatus)
  if (!doc) return notFound()

  return NextResponse.json(doc)
}
