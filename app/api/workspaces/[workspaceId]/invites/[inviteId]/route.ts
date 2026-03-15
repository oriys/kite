import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { revokeInvite } from '@/lib/queries/invites'
import { verifyWorkspaceMembership } from '@/lib/queries/workspaces'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; inviteId: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { workspaceId, inviteId } = await params
  const membership = await verifyWorkspaceMembership(
    result.ctx.userId,
    workspaceId,
  )
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await revokeInvite(workspaceId, inviteId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return badRequest((e as Error).message)
  }
}
