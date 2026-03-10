import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { workspaces, workspaceMembers } from '../schema'

export async function getUserWorkspaces(userId: string) {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      createdAt: workspaces.createdAt,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))

  return rows
}

export async function createWorkspace(
  name: string,
  slug: string,
  ownerId: string,
) {
  const [ws] = await db.insert(workspaces).values({ name, slug }).returning()
  await db
    .insert(workspaceMembers)
    .values({ userId: ownerId, workspaceId: ws.id, role: 'owner' })
  return ws
}

export async function ensureDefaultWorkspace(
  userId: string,
  userName: string,
) {
  const existing = await getUserWorkspaces(userId)
  if (existing.length > 0) return existing[0]

  const slug = `ws-${userId.slice(0, 8)}`
  const name = userName ? `${userName}'s Workspace` : 'My Workspace'
  return createWorkspace(name, slug, userId)
}

export async function getDefaultWorkspace(userId: string) {
  const userWorkspaces = await getUserWorkspaces(userId)
  return userWorkspaces[0] ?? null
}

export async function verifyWorkspaceMembership(
  userId: string,
  workspaceId: string,
) {
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    )
  return member ?? null
}
