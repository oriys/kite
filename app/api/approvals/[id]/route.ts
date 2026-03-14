import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { getApprovalRequest } from '@/lib/queries/approvals'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await params
  const approval = await getApprovalRequest(id, result.ctx.workspaceId)
  if (!approval) return notFound()

  return NextResponse.json(approval)
}
