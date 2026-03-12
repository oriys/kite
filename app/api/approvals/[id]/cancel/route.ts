import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { cancelApprovalRequest } from '@/lib/queries/approvals'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const { id } = await params
  const approval = await cancelApprovalRequest(id)
  if (!approval) return notFound()

  return NextResponse.json(approval)
}
