import { db } from '@/lib/db'
import { partnerGroups, partnerGroupMembers, users } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function listPartnerGroups(workspaceId: string) {
  return db
    .select()
    .from(partnerGroups)
    .where(eq(partnerGroups.workspaceId, workspaceId))
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
    .delete(partnerGroups)
    .where(eq(partnerGroups.id, id))
    .returning()
  return deleted ?? null
}

export async function addMemberToGroup(groupId: string, userId: string) {
  const [member] = await db
    .insert(partnerGroupMembers)
    .values({ groupId, userId })
    .onConflictDoNothing()
    .returning()
  return member ?? null
}

export async function removeMemberFromGroup(groupId: string, userId: string) {
  const [removed] = await db
    .delete(partnerGroupMembers)
    .where(
      and(
        eq(partnerGroupMembers.groupId, groupId),
        eq(partnerGroupMembers.userId, userId),
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
    .where(eq(partnerGroupMembers.groupId, groupId))
}
