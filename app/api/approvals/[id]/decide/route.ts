import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { submitApprovalDecision } from '@/lib/queries/approvals'
import { createNotification } from '@/lib/queries/notifications'
import { emitAuditEvent } from '@/lib/queries/audit-logs'
import { dispatchWebhookEvent } from '@/lib/queries/webhooks'
import { dispatchToChannels } from '@/lib/notification-sender'

const DECISION_LABELS: Record<string, string> = {
  approved: 'approved',
  rejected: 'rejected',
  changes_requested: 'requested changes on',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const decision = body.decision
  if (!['approved', 'rejected', 'changes_requested'].includes(decision))
    return badRequest('Invalid decision. Must be approved, rejected, or changes_requested')

  const outcome = await submitApprovalDecision(
    result.ctx.workspaceId,
    id,
    result.ctx.userId,
    decision,
    body.comment,
  )

  if (!outcome) return notFound()

  // Notify the requester about the decision
  if (outcome.requesterId && outcome.requesterId !== result.ctx.userId) {
    await createNotification({
      recipientId: outcome.requesterId,
      workspaceId: result.ctx.workspaceId,
      type: 'approval_decision',
      title: `Review ${DECISION_LABELS[decision] ?? decision} your document`,
      body: body.comment ? `Comment: ${body.comment}` : `A reviewer has ${DECISION_LABELS[decision] ?? decision} your document.`,
      linkUrl: outcome.documentId ? `/docs/editor?doc=${outcome.documentId}` : undefined,
      resourceType: 'approval',
      resourceId: id,
      actorId: result.ctx.userId,
    })
  }

  // Audit event
  const AUDIT_ACTIONS = {
    approved: 'approve',
    rejected: 'reject',
    changes_requested: 'request_changes',
  } as const
  const auditAction = AUDIT_ACTIONS[decision as keyof typeof AUDIT_ACTIONS]
  emitAuditEvent({
    workspaceId: result.ctx.workspaceId,
    actorId: result.ctx.userId,
    action: auditAction,
    resourceType: 'approval',
    resourceId: id,
    metadata: { decision, comment: body.comment, documentId: outcome.documentId },
  }).catch(() => {})

  // Webhook + channel dispatch
  const WEBHOOK_EVENTS: Record<string, string> = {
    approved: 'approval.approved',
    rejected: 'approval.rejected',
    changes_requested: 'approval.changes_requested',
  }
  const webhookEvent = WEBHOOK_EVENTS[decision] ?? `approval.${decision}`
  dispatchWebhookEvent(result.ctx.workspaceId, webhookEvent, {
    approvalId: id,
    documentId: outcome.documentId,
    decision,
    reviewerId: result.ctx.userId,
    comment: body.comment,
  }).catch(() => {})

  dispatchToChannels({
    type: webhookEvent,
    title: `Approval ${decision}`,
    body: `A reviewer has ${DECISION_LABELS[decision] ?? decision} a document.`,
    workspaceId: result.ctx.workspaceId,
    linkUrl: outcome.documentId ? `/docs/editor?doc=${outcome.documentId}` : undefined,
  }).catch(() => {})

  return NextResponse.json(outcome)
}
