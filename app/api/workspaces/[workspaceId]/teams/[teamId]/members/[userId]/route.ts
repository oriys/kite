import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { removeTeamMember } from '@/lib/queries/teams'
import { verifyWorkspaceMembership } from '@/lib/queries/workspaces'

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ workspaceId: string; teamId: string; userId: string }>
  },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { workspaceId, teamId, userId } = await params
  const membership = await verifyWorkspaceMembership(
    result.ctx.userId,
    workspaceId,
  )
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await removeTeamMember(workspaceId, teamId, userId, result.ctx.userId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return badRequest((e as Error).message)
  }
}
