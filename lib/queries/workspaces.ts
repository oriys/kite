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
  return db.transaction(async (tx) => {
    const [ws] = await tx.insert(workspaces).values({ name, slug }).returning()
    await tx
      .insert(workspaceMembers)
      .values({ userId: ownerId, workspaceId: ws.id, role: 'owner' })

    return {
      ...ws,
      role: 'owner' as const,
    }
  })
}

export async function ensureDefaultWorkspace(
  userId: string,
  userName: string,
): Promise<UserWorkspace> {
  const existing = await getUserWorkspaces(userId)
  if (existing.length > 0) return existing[0]

  const slug = `ws-${userId.slice(0, 8)}`
  const wsName = userName ? `${userName}'s Workspace` : 'My Workspace'
  try {
    return await createWorkspace(wsName, slug, userId)
  } catch {
    // Race condition: another request created the workspace concurrently.
    // The unique slug constraint prevents duplicates — return the existing one.
    const retried = await getUserWorkspaces(userId)
    if (retried.length > 0) return retried[0]
    throw new Error('Failed to create default workspace')
  }
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
