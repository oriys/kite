import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound, badRequest } from '@/lib/api-utils'
import {
  getApprovalPolicy,
  updateApprovalPolicy,
  deleteApprovalPolicy,
} from '@/lib/queries/approval-policies'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const policy = await getApprovalPolicy(id, result.ctx.workspaceId)
  if (!policy) return notFound()

  return NextResponse.json(policy)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = body.name
  if (body.policyType !== undefined) patch.policyType = body.policyType
  if (body.config !== undefined) patch.config = body.config
  if (body.isDefault !== undefined) patch.isDefault = body.isDefault

  const policy = await updateApprovalPolicy(id, result.ctx.workspaceId, patch)
  if (!policy) return notFound()

  return NextResponse.json(policy)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const deleted = await deleteApprovalPolicy(id, result.ctx.workspaceId)
  if (!deleted) return notFound()

  return NextResponse.json({ success: true })
}
