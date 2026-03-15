import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  withWorkspaceAuth,
  notFound,
  badRequest,
  forbidden,
} from '@/lib/api-utils'
import {
  getDocumentByIdentifier,
  transitionDocument,
} from '@/lib/queries/documents'
import {
  attachDocumentAccess,
  buildDocumentAccessMap,
} from '@/lib/queries/document-permissions'
import type { DocStatus } from '@/lib/documents'
import { isValidStatus, ALLOWED_TRANSITIONS } from '@/lib/constants'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body?.status || !isValidStatus(body.status)) {
    return badRequest('Invalid status')
  }

  const { id } = await context.params
  const existing = await getDocumentByIdentifier(id, result.ctx.workspaceId)
  if (!existing) return notFound()

  const access = (
    await buildDocumentAccessMap([existing], result.ctx.userId, result.ctx.role)
  ).get(existing.id)
  if (!access?.canTransition) return forbidden()

  const newStatus = body.status as DocStatus
  const allowed = ALLOWED_TRANSITIONS[existing.status as DocStatus]
  if (!allowed?.includes(newStatus)) {
    return badRequest(
      `Cannot transition from "${existing.status}" to "${newStatus}"`,
    )
  }

  const doc = await transitionDocument(existing.id, result.ctx.workspaceId, newStatus)
  if (!doc) return notFound()

  const updatedAccess = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)

  return NextResponse.json(attachDocumentAccess(doc, updatedAccess!))
}
