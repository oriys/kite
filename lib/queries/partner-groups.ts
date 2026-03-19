import { db } from '@/lib/db'
import { partnerGroups, partnerGroupMembers, users } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'

export async function listPartnerGroups(workspaceId: string) {
  return db
    .select({
      id: partnerGroups.id,
      workspaceId: partnerGroups.workspaceId,
      name: partnerGroups.name,
      createdAt: partnerGroups.createdAt,
    })
    .from(partnerGroups)
    .where(and(eq(partnerGroups.workspaceId, workspaceId), isNull(partnerGroups.deletedAt)))
    .orderBy(partnerGroups.createdAt)
}

export async function createPartnerGroup(workspaceId: string, name: string) {
  const [group] = await db
    .insert(partnerGroups)
    .values({ workspaceId, name })
    .returning()
  return group
}

export async function deletePartnerGroup(id: string, workspaceId: string) {
  const [deleted] = await db
    .update(partnerGroups)
    .set({ deletedAt: new Date() })
    .where(and(eq(partnerGroups.id, id), eq(partnerGroups.workspaceId, workspaceId), isNull(partnerGroups.deletedAt)))
    .returning()
  return deleted ?? null
}

export async function addMemberToGroup(workspaceId: string, groupId: string, userId: string) {
  // Verify group belongs to workspace
  const [group] = await db
    .select({ id: partnerGroups.id })
    .from(partnerGroups)
    .where(and(eq(partnerGroups.id, groupId), eq(partnerGroups.workspaceId, workspaceId), isNull(partnerGroups.deletedAt)))
    .limit(1)
  if (!group) return null

  const [member] = await db
    .insert(partnerGroupMembers)
    .values({ groupId, userId })
    .onConflictDoUpdate({
      target: [partnerGroupMembers.groupId, partnerGroupMembers.userId],
      set: { deletedAt: null },
    })
    .returning()
  return member ?? null
}

export async function removeMemberFromGroup(workspaceId: string, groupId: string, userId: string) {
  // Verify group belongs to workspace
  const [group] = await db
    .select({ id: partnerGroups.id })
    .from(partnerGroups)
    .where(and(eq(partnerGroups.id, groupId), eq(partnerGroups.workspaceId, workspaceId), isNull(partnerGroups.deletedAt)))
    .limit(1)
  if (!group) return null

  const [removed] = await db
    .update(partnerGroupMembers)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(partnerGroupMembers.groupId, groupId),
        eq(partnerGroupMembers.userId, userId),
        isNull(partnerGroupMembers.deletedAt),
      ),
    )
    .returning()
  return removed ?? null
}

export async function getGroupMembers(workspaceId: string, groupId: string) {
  return db
    .select({
      userId: partnerGroupMembers.userId,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(partnerGroupMembers)
    .innerJoin(users, eq(users.id, partnerGroupMembers.userId))
    .innerJoin(partnerGroups, and(
      eq(partnerGroups.id, partnerGroupMembers.groupId),
      eq(partnerGroups.workspaceId, workspaceId),
      isNull(partnerGroups.deletedAt),
    ))
    .where(
      and(
        eq(partnerGroupMembers.groupId, groupId),
        isNull(partnerGroupMembers.deletedAt),
      ),
    )
}
