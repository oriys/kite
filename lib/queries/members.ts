import { eq, and, desc, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db } from '../db'
import { workspaceMembers, users } from '../schema'
import { emitAuditEvent } from './audit-logs'

export type MemberRole = 'owner' | 'admin' | 'member' | 'guest'
export type MemberStatus = 'active' | 'disabled'

export interface WorkspaceMember {
  userId: string
  name: string | null
  email: string | null
  image: string | null
  role: MemberRole
  status: MemberStatus
  joinedAt: Date
  invitedBy: string | null
}

export async function listWorkspaceMembers(
  workspaceId: string,
  options: { search?: string; role?: MemberRole; status?: MemberStatus } = {},
): Promise<WorkspaceMember[]> {
  const conditions: SQL<unknown>[] = [eq(workspaceMembers.workspaceId, workspaceId)]

  if (options.role) conditions.push(eq(workspaceMembers.role, options.role))
  if (options.status) conditions.push(eq(workspaceMembers.status, options.status))
  if (options.search?.trim()) {
    const pattern = `%${options.search.trim()}%`
    conditions.push(
      or(ilike(users.name, pattern), ilike(users.email, pattern))!,
    )
  }

  const rows = await db
    .select({
      userId: workspaceMembers.userId,
      name: users.name,
      email: users.email,
      image: users.image,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      joinedAt: workspaceMembers.joinedAt,
      invitedBy: workspaceMembers.invitedBy,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(workspaceMembers.joinedAt))

  return rows as WorkspaceMember[]
}

export async function updateMemberRole(
  workspaceId: string,
  targetUserId: string,
  newRole: MemberRole,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, targetUserId),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      )

    if (!current) throw new Error('Member not found')
    if (current.role === 'owner' && newRole !== 'owner') {
      const owners = await tx
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.role, 'owner'),
          ),
        )
        .for('update')
      if (owners.length <= 1) throw new Error('Cannot demote the last owner')
    }

    await tx
      .update(workspaceMembers)
      .set({ role: newRole })
      .where(
        and(
          eq(workspaceMembers.userId, targetUserId),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      )

    await emitAuditEvent({
      workspaceId,
      actorId,
      action: 'role_change',
      resourceType: 'member',
      resourceId: targetUserId,
      metadata: { oldRole: current.role, newRole },
    })
  })
}

export async function updateMemberStatus(
  workspaceId: string,
  targetUserId: string,
  status: MemberStatus,
  _actorId: string,
) {
  const [current] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, targetUserId),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    )

  if (!current) throw new Error('Member not found')
  if (current.role === 'owner') throw new Error('Cannot disable an owner')

  await db
    .update(workspaceMembers)
    .set({ status })
    .where(
      and(
        eq(workspaceMembers.userId, targetUserId),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    )
}

export async function removeMember(
  workspaceId: string,
  targetUserId: string,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, targetUserId),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      )

    if (!current) throw new Error('Member not found')
    if (current.role === 'owner') {
      const owners = await tx
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.role, 'owner'),
          ),
        )
        .for('update')
      if (owners.length <= 1) throw new Error('Cannot remove the last owner')
    }

    await tx
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, targetUserId),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      )

    await emitAuditEvent({
      workspaceId,
      actorId,
      action: 'member_remove',
      resourceType: 'member',
      resourceId: targetUserId,
    })
  })
}

export async function getMemberCount(workspaceId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId))
  return Number(count)
}
