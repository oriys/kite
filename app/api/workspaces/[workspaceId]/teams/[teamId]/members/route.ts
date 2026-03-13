import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { addTeamMember } from '@/lib/queries/teams'
import { verifyWorkspaceMembership } from '@/lib/queries/workspaces'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; teamId: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { workspaceId, teamId } = await params
  const membership = await verifyWorkspaceMembership(
    result.ctx.userId,
    workspaceId,
  )
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!userId) return badRequest('userId is required')

  try {
    await addTeamMember(workspaceId, teamId, userId, result.ctx.userId)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (e) {
    return badRequest((e as Error).message)
  }
}
