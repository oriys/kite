import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  createApprovalRequest,
  listApprovalRequests,
} from '@/lib/queries/approvals'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | 'cancelled' | null
  const reviewerId = searchParams.get('reviewerId')

  const items = await listApprovalRequests(result.ctx.workspaceId, {
    status: status ?? undefined,
    reviewerId: reviewerId ?? undefined,
  })

  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('editor')
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

  return NextResponse.json(approval, { status: 201 })
}
