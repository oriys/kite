import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  createEmailInvite,
  createLinkInvite,
  listPendingInvites,
} from '@/lib/queries/invites'
import type { MemberRole } from '@/lib/queries/members'
import { verifyWorkspaceMembership } from '@/lib/queries/workspaces'

export async function GET(
  _request: NextRequest,
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

  const invites = await listPendingInvites(workspaceId)
  return NextResponse.json(invites)
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

  const type = body.type as 'email' | 'link'
  if (!['email', 'link'].includes(type)) return badRequest('Invalid type')

  const role = (body.role as MemberRole) ?? 'member'
  const validRoles: MemberRole[] = ['admin', 'member', 'guest']
  if (!validRoles.includes(role)) return badRequest('Invalid role')

  // Only owners can invite as admin
  if (role === 'admin' && membership.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    if (type === 'email') {
      const email = typeof body.email === 'string' ? body.email.trim() : ''
      if (!email || !email.includes('@')) return badRequest('Invalid email')
      const invite = await createEmailInvite(
        workspaceId,
        email,
        role,
        result.ctx.userId,
      )
      return NextResponse.json(invite, { status: 201 })
    } else {
      const invite = await createLinkInvite(
        workspaceId,
        role,
        result.ctx.userId,
      )
      return NextResponse.json(invite, { status: 201 })
    }
  } catch (e) {
    return badRequest((e as Error).message)
  }
}
