import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import {
  listWorkspaceMembers,
  type MemberRole,
  type MemberStatus,
} from '@/lib/queries/members'
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

  const url = new URL(_request.url)
  const search = url.searchParams.get('search') ?? undefined
  const role = (url.searchParams.get('role') as MemberRole) ?? undefined
  const status = (url.searchParams.get('status') as MemberStatus) ?? undefined

  const members = await listWorkspaceMembers(workspaceId, {
    search,
    role,
    status,
  })
  return NextResponse.json(members)
}
