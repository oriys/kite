import { NextResponse } from 'next/server'
import { auth } from './auth'
import { getDefaultWorkspace, verifyWorkspaceMembership } from './queries/workspaces'

type MemberRole = 'owner' | 'admin' | 'member' | 'guest'

interface WorkspaceContext {
  userId: string
  workspaceId: string
  role: MemberRole
}

export async function getAuthenticatedUser() {
  const session = await auth()
  return session?.user ?? null
}

export async function getWorkspaceContext(userId: string) {
  return getDefaultWorkspace(userId)
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
  const user = await getAuthenticatedUser()
  if (!user?.id) return { error: unauthorized() }

  const workspace = await getDefaultWorkspace(user.id)
  if (!workspace) return { error: forbidden() }

  const membership = await verifyWorkspaceMembership(user.id, workspace.id)
  if (!membership) return { error: forbidden() }

  const role = membership.role as MemberRole
  if (!hasMinimumRole(role, requiredRole)) return { error: forbidden() }

  return { ctx: { userId: user.id, workspaceId: workspace.id, role } }
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
