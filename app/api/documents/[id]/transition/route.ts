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
import {
  getPendingApprovalsForDocument,
  getApprovedApprovalForDocument,
} from '@/lib/queries/approvals'
import { emitResourceEvent } from '@/lib/resource-events'
import { runPublishPreflight } from '@/lib/publish-preflight'
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

  // Enforce approval gate for review → published
  if (existing.status === 'review' && newStatus === 'published') {
    // Run preflight checks
    const preflight = await runPublishPreflight(existing.id, result.ctx.workspaceId)
    if (!preflight.pass) {
      return NextResponse.json(
        { error: 'Publish preflight failed', checks: preflight.checks },
        { status: 422 },
      )
    }

    const pending = await getPendingApprovalsForDocument(existing.id, result.ctx.workspaceId)
    if (pending) {
      return badRequest('Cannot publish while an approval request is still pending')
    }

    const approved = await getApprovedApprovalForDocument(existing.id, result.ctx.workspaceId)
    if (!approved) {
      return badRequest('An approved approval request is required before publishing')
    }
  }

  const doc = await transitionDocument(existing.id, result.ctx.workspaceId, newStatus, result.ctx.userId)
  if (!doc) return notFound()

  const updatedAccess = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)

  emitResourceEvent({
    workspaceId: result.ctx.workspaceId,
    actorId: result.ctx.userId,
    action: 'status_change',
    resourceType: 'document',
    resourceId: existing.id,
    resourceTitle: existing.title,
    metadata: { from: existing.status, to: newStatus },
    webhookEvent: `document.${newStatus}`,
    webhookPayload: { status: newStatus, previousStatus: existing.status },
    channel: {
      title: `Document ${newStatus}: ${existing.title}`,
      body: `"${existing.title}" has been moved to ${newStatus}.`,
      linkUrl: `/docs/editor?doc=${existing.id}`,
    },
  })

  if (newStatus === 'published') {
    emitResourceEvent({
      workspaceId: result.ctx.workspaceId,
      actorId: result.ctx.userId,
      action: 'publish',
      resourceType: 'document',
      resourceId: existing.id,
      resourceTitle: existing.title,
    })
  }

  return NextResponse.json(attachDocumentAccess(doc, updatedAccess!))
}
