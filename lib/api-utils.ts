import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { auth } from './auth'
import { db } from './db'
import { users } from './schema'
import {
  ensureDefaultWorkspace,
  getDefaultWorkspace,
  verifyWorkspaceMembership,
} from './queries/workspaces'

type MemberRole = 'owner' | 'admin' | 'member' | 'guest'

interface WorkspaceContext {
  userId: string
  workspaceId: string
  workspaceName: string
  role: MemberRole
}

export async function getAuthenticatedUser() {
  const session = await auth()
  return session?.user ?? null
}

export async function resolveAuthenticatedUser(
  sessionUser: Awaited<ReturnType<typeof getAuthenticatedUser>>,
) {
  if (!sessionUser?.id) {
    return null
  }

  const byId = await db.query.users.findFirst({
    where: eq(users.id, sessionUser.id),
  })
  if (byId) {
    return byId
  }

  if (sessionUser.email) {
    const byEmail = await db.query.users.findFirst({
      where: eq(users.email, sessionUser.email),
    })
    if (byEmail) {
      return byEmail
    }
  }

  const [createdUser] = await db
    .insert(users)
    .values({
      id: sessionUser.id,
      name: sessionUser.name ?? null,
      email: sessionUser.email ?? null,
      image: sessionUser.image ?? null,
    })
    .onConflictDoNothing()
    .returning()

  if (createdUser) {
    return createdUser
  }

  return db.query.users.findFirst({
    where: eq(users.id, sessionUser.id),
  })
}

/**
 * Authenticate user and verify workspace membership in one call.
 * Pass `requiredRole` to enforce minimum permissions:
 *   - 'guest'   = any member (including guests)
 *   - 'member'  = member, admin, or owner
 *   - 'admin'   = admin or owner
 *   - 'owner'   = owner only
 */
export async function withWorkspaceAuth(
  requiredRole: MemberRole = 'guest',
): Promise<{ ctx: WorkspaceContext } | { error: NextResponse }> {
  const sessionUser = await getAuthenticatedUser()
  if (!sessionUser?.id) return { error: unauthorized() }

  const user = await resolveAuthenticatedUser(sessionUser)
  if (!user?.id) return { error: forbidden() }

  let workspace = await getDefaultWorkspace(user.id)
  if (!workspace) {
    workspace = await ensureDefaultWorkspace(user.id, user.name ?? 'My Workspace')
  }
  if (!workspace) return { error: forbidden() }

  const membership = await verifyWorkspaceMembership(user.id, workspace.id)
  if (!membership) return { error: forbidden() }

  const role = membership.role as MemberRole
  if (!hasMinimumRole(role, requiredRole)) return { error: forbidden() }

  return {
    ctx: {
      userId: user.id,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      role,
    },
  }
}

const ROLE_LEVELS: Record<MemberRole, number> = {
  guest: 0,
  member: 1,
  admin: 2,
  owner: 3,
}

function hasMinimumRole(actual: MemberRole, required: MemberRole): boolean {
  return ROLE_LEVELS[actual] >= ROLE_LEVELS[required]
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export function badRequest(message = 'Bad request') {
  return NextResponse.json({ error: message }, { status: 400 })
}
