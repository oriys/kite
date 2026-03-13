import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  getTeam,
  updateTeam,
  deleteTeam,
  listTeamMembers,
} from '@/lib/queries/teams'
import { verifyWorkspaceMembership } from '@/lib/queries/workspaces'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; teamId: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { workspaceId, teamId } = await params
  const membership = await verifyWorkspaceMembership(
    result.ctx.userId,
    workspaceId,
  )
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const team = await getTeam(workspaceId, teamId)
  if (!team) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const members = await listTeamMembers(teamId)
  return NextResponse.json({ ...team, members })
}

export async function PATCH(
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

  const data: { name?: string; description?: string; parentId?: string | null } = {}
  if (typeof body.name === 'string') data.name = body.name.trim()
  if (typeof body.description === 'string') data.description = body.description.trim()
  if (body.parentId !== undefined) data.parentId = body.parentId

  try {
    const team = await updateTeam(
      workspaceId,
      teamId,
      data,
      result.ctx.userId,
    )
    return NextResponse.json(team)
  } catch (e) {
    return badRequest((e as Error).message)
  }
}

export async function DELETE(
  _request: NextRequest,
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

  try {
    await deleteTeam(workspaceId, teamId, result.ctx.userId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return badRequest((e as Error).message)
  }
}
