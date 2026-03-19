import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  createApprovalPolicy,
  listApprovalPolicies,
} from '@/lib/queries/approval-policies'

export async function GET() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const policies = await listApprovalPolicies(result.ctx.workspaceId)
  return NextResponse.json(policies)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('Name is required')

  const policyType = typeof body.policyType === 'string' ? body.policyType : 'standard'
  const config = typeof body.config === 'object' && body.config ? body.config : {}

  const policy = await createApprovalPolicy(
    result.ctx.workspaceId,
    name,
    policyType,
    config,
    !!body.isDefault,
  )

  return NextResponse.json(policy, { status: 201 })
}
