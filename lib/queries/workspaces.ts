import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { workspaces, workspaceMembers } from '../schema'

type UserWorkspace = Pick<
  typeof workspaces.$inferSelect,
  'id' | 'name' | 'slug' | 'createdAt'
> & {
  role: typeof workspaceMembers.$inferSelect.role
}

export async function getUserWorkspaces(userId: string): Promise<UserWorkspace[]> {
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
    .orderBy(workspaces.createdAt)

  return rows
}

export async function createWorkspace(
  name: string,
  slug: string,
  ownerId: string,
) : Promise<UserWorkspace> {
  const [ws] = await db.insert(workspaces).values({ name, slug }).returning()
  await db
    .insert(workspaceMembers)
    .values({ userId: ownerId, workspaceId: ws.id, role: 'owner' })

  return {
    ...ws,
    role: 'owner',
  }
}

export async function ensureDefaultWorkspace(
  userId: string,
  userName: string,
): Promise<UserWorkspace> {
  const existing = await getUserWorkspaces(userId)
  if (existing.length > 0) return existing[0]

  const slug = `ws-${userId.slice(0, 8)}`
  const name = userName ? `${userName}'s Workspace` : 'My Workspace'
  return createWorkspace(name, slug, userId)
}

export async function getDefaultWorkspace(
  userId: string,
): Promise<UserWorkspace | null> {
  const userWorkspaces = await getUserWorkspaces(userId)
  return userWorkspaces[0] ?? null
}

export async function verifyWorkspaceMembership(
  userId: string,
  workspaceId: string,
) {
  const [member] = await db
    .select({
      userId: workspaceMembers.userId,
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
    })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    )
  return member ?? null
}
