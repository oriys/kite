import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import {
  getGroupMembers,
  addMemberToGroup,
  removeMemberFromGroup,
} from '@/lib/queries/partner-groups'
import { db } from '@/lib/db'
import { partnerGroups } from '@/lib/schema'
import { and, eq, isNull } from 'drizzle-orm'

async function verifyGroupOwnership(groupId: string, workspaceId: string) {
  const [group] = await db
    .select({ id: partnerGroups.id })
    .from(partnerGroups)
    .where(
      and(
        eq(partnerGroups.id, groupId),
        eq(partnerGroups.workspaceId, workspaceId),
        isNull(partnerGroups.deletedAt),
      ),
    )
    .limit(1)
  return group ?? null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const { id } = await params
  const group = await verifyGroupOwnership(id, result.ctx.workspaceId)
  if (!group) return notFound()

  const members = await getGroupMembers(id)
  return NextResponse.json(members)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const { id } = await params
  const group = await verifyGroupOwnership(id, result.ctx.workspaceId)
  if (!group) return notFound()

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!userId) return badRequest('userId is required')

  const member = await addMemberToGroup(id, userId)
  return NextResponse.json(member ?? { groupId: id, userId }, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const { id } = await params
  const group = await verifyGroupOwnership(id, result.ctx.workspaceId)
  if (!group) return notFound()

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!userId) return badRequest('userId is required')

  const removed = await removeMemberFromGroup(id, userId)
  if (!removed) return notFound()

  return NextResponse.json({ success: true })
}
