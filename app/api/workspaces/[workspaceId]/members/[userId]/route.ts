import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  updateMemberRole,
  updateMemberStatus,
  removeMember,
  type MemberRole,
  type MemberStatus,
} from '@/lib/queries/members'
import { verifyWorkspaceMembership } from '@/lib/queries/workspaces'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; userId: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { workspaceId, userId } = await params
  const membership = await verifyWorkspaceMembership(
    result.ctx.userId,
    workspaceId,
  )
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  try {
    if (body.role) {
      const validRoles: MemberRole[] = ['owner', 'admin', 'member', 'guest']
      if (!validRoles.includes(body.role)) return badRequest('Invalid role')
      // Only owners can promote to owner or admin
      if (
        (body.role === 'owner' || body.role === 'admin') &&
        membership.role !== 'owner'
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      await updateMemberRole(workspaceId, userId, body.role, result.ctx.userId)
    }

    if (body.status) {
      const validStatuses: MemberStatus[] = ['active', 'disabled']
      if (!validStatuses.includes(body.status))
        return badRequest('Invalid status')
      await updateMemberStatus(
        workspaceId,
        userId,
        body.status,
        result.ctx.userId,
      )
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return badRequest((e as Error).message)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; userId: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { workspaceId, userId } = await params
  const membership = await verifyWorkspaceMembership(
    result.ctx.userId,
    workspaceId,
  )
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prevent self-removal
  if (userId === result.ctx.userId) {
    return badRequest('Cannot remove yourself')
  }

  try {
    await removeMember(workspaceId, userId, result.ctx.userId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return badRequest((e as Error).message)
  }
}
