import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { submitApprovalDecision } from '@/lib/queries/approvals'
import { createNotification } from '@/lib/queries/notifications'

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

  return NextResponse.json(outcome)
}
