import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  createApprovalRequest,
  listApprovalRequests,
} from '@/lib/queries/approvals'
import { createBulkNotifications } from '@/lib/queries/notifications'
import { emitAuditEvent } from '@/lib/queries/audit-logs'
import { dispatchWebhookEvent } from '@/lib/queries/webhooks'
import { dispatchToChannels } from '@/lib/notification-sender'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | 'cancelled' | null
  const reviewerId = searchParams.get('reviewerId')
  const documentId = searchParams.get('documentId')
  const limit = Math.min(Number(searchParams.get('limit') ?? 30), 100)
  const offset = Number(searchParams.get('offset') ?? 0)

  const items = await listApprovalRequests(result.ctx.workspaceId, {
    status: status ?? undefined,
    reviewerId: reviewerId ?? undefined,
    documentId: documentId ?? undefined,
    limit,
    offset,
  })

  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const documentId = typeof body.documentId === 'string' ? body.documentId : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const reviewerIds = Array.isArray(body.reviewerIds) ? body.reviewerIds : []

  if (!documentId) return badRequest('Document ID is required')
  if (!title) return badRequest('Title is required')
  if (reviewerIds.length === 0) return badRequest('At least one reviewer is required')

  const approval = await createApprovalRequest(
    result.ctx.workspaceId,
    documentId,
    result.ctx.userId,
    title,
    reviewerIds,
    {
      description: body.description,
      requiredApprovals: body.requiredApprovals,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
    },
  )

  // Notify all reviewers
  await createBulkNotifications(
    reviewerIds.map((reviewerId: string) => ({
      recipientId: reviewerId,
      workspaceId: result.ctx.workspaceId,
      type: 'approval_request' as const,
      title: 'Review requested',
      body: `You have been asked to review: ${title}`,
      linkUrl: `/docs/editor?doc=${documentId}`,
      resourceType: 'approval',
      resourceId: approval.id,
      actorId: result.ctx.userId,
    })),
  )

  emitAuditEvent({
    workspaceId: result.ctx.workspaceId,
    actorId: result.ctx.userId,
    action: 'create',
    resourceType: 'approval',
    resourceId: approval.id,
    resourceTitle: title,
    metadata: { documentId, reviewerIds },
  }).catch(() => {})

  dispatchWebhookEvent(result.ctx.workspaceId, 'approval.requested', {
    approvalId: approval.id,
    documentId,
    title,
    requesterId: result.ctx.userId,
    reviewerIds,
  }).catch(() => {})

  dispatchToChannels({
    type: 'approval.requested',
    title: 'Approval requested',
    body: `Review requested for: ${title}`,
    workspaceId: result.ctx.workspaceId,
    linkUrl: `/docs/editor?doc=${documentId}`,
  }).catch(() => {})

  return NextResponse.json(approval, { status: 201 })
}
