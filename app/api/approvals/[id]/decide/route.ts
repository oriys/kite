import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { submitApprovalDecision } from '@/lib/queries/approvals'

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

  return NextResponse.json(outcome)
}
