import { db } from '@/lib/db'
import { partnerGroups, partnerGroupMembers, users } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'

export async function listPartnerGroups(workspaceId: string) {
  return db
    .select()
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

export async function deletePartnerGroup(id: string) {
  const [deleted] = await db
    .update(partnerGroups)
    .set({ deletedAt: new Date() })
    .where(and(eq(partnerGroups.id, id), isNull(partnerGroups.deletedAt)))
    .returning()
  return deleted ?? null
}

export async function addMemberToGroup(groupId: string, userId: string) {
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

export async function removeMemberFromGroup(groupId: string, userId: string) {
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

export async function getGroupMembers(groupId: string) {
  return db
    .select({
      userId: partnerGroupMembers.userId,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(partnerGroupMembers)
    .innerJoin(users, eq(users.id, partnerGroupMembers.userId))
    .where(
      and(
        eq(partnerGroupMembers.groupId, groupId),
        isNull(partnerGroupMembers.deletedAt),
      ),
    )
}
