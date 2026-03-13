import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { listTeams, createTeam } from '@/lib/queries/teams'
import { verifyWorkspaceMembership } from '@/lib/queries/workspaces'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { workspaceId } = await params
  const membership = await verifyWorkspaceMembership(
    result.ctx.userId,
    workspaceId,
  )
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const teamList = await listTeams(workspaceId)
  return NextResponse.json(teamList)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { workspaceId } = await params
  const membership = await verifyWorkspaceMembership(
    result.ctx.userId,
    workspaceId,
  )
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('Name is required')
  if (name.length > 100) return badRequest('Name too long')

  const description =
    typeof body.description === 'string' ? body.description.trim() : ''
  const parentId =
    typeof body.parentId === 'string' ? body.parentId : null

  try {
    const team = await createTeam(
      workspaceId,
      name,
      description,
      parentId,
      result.ctx.userId,
    )
    return NextResponse.json(team, { status: 201 })
  } catch (e) {
    return badRequest((e as Error).message)
  }
}
